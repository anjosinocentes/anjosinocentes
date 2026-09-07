import { Pool } from "pg"

// Adaptador de "coleção de documentos" sobre Postgres/Supabase: expõe uma API de
// collection (find/findOne/insertOne/updateOne/...) e grava cada registro como um
// documento JSONB - uma coluna `doc` por linha - usado pelas rotas em app/api/**/route.ts.
const ALLOWED_TABLES = new Set([
  "users",
  "students",
  "classes",
  "attendances",
  "lessons",
  "courses",
  "events",
  "audit_logs",
  "announcements",
  "student_attachments",
  "pdis",
  "pdi_tracking",
  "pdi_evolutions",
  "password_resets",
  "password_reset_attempts",
  "login_attempts",
])

let pool: Pool | undefined

function getPool(connectionString: string) {
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("supabase.co") || connectionString.includes("supabase.com")
        ? { rejectUnauthorized: false }
        : undefined,
    })
  }
  return pool
}

function toComparableText(v: any): string | null {
  if (v instanceof Date) return v.toISOString()
  if (v === null || v === undefined) return null
  if (typeof v === "boolean") return v ? "true" : "false"
  return String(v)
}

function prepareForStorage(value: any): any {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(prepareForStorage)
  if (value && typeof value === "object") {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) out[k] = prepareForStorage(v)
    return out
  }
  return value
}

function pushParam(params: any[], val: any) {
  params.push(val)
  return `$${params.length}`
}

// Suporta só os operadores usados pelo app (ver app/api/**/route.ts e lib/password-reset.ts).
// $regex aqui só cobre o caso real de uso: um literal totalmente escapado e ancorado com
// ^...$ (busca de e-mail case-insensitive), não regex arbitrária.
// Nomes de campo entram direto na SQL (JSONB `doc->>'campo'`), então não podem ser parametrizados.
// Como defesa em profundidade contra injeção via CHAVE de filtro, exigimos um nome simples
// (letras, dígitos, _). Hoje todas as chaves vêm do código, mas isto protege caso uma rota futura
// repasse uma chave vinda do usuário.
function assertField(field: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(field)) {
    throw new Error(`Nome de campo inválido em filtro/ordenação: ${field}`)
  }
  return field
}

function buildOpClause(field: string, op: string, opVal: any, params: any[]): string {
  assertField(field)
  const col = `(doc->>'${field}')`
  switch (op) {
    case "$ne": {
      if (opVal === null) return `${col} IS NOT NULL`
      const p = pushParam(params, toComparableText(opVal))
      return `${col} IS DISTINCT FROM ${p}`
    }
    case "$in": {
      const arr = (opVal || []).map(toComparableText)
      const p = pushParam(params, arr)
      return `${col} = ANY(${p})`
    }
    case "$gte": {
      const p = pushParam(params, toComparableText(opVal))
      return `${col} >= ${p}`
    }
    case "$lte": {
      const p = pushParam(params, toComparableText(opVal))
      return `${col} <= ${p}`
    }
    case "$gt": {
      const p = pushParam(params, toComparableText(opVal))
      return `${col} > ${p}`
    }
    case "$lt": {
      const p = pushParam(params, toComparableText(opVal))
      return `${col} < ${p}`
    }
    case "$exists":
      return opVal ? `doc ? '${field}'` : `NOT (doc ? '${field}')`
    case "$regex": {
      let src = String(opVal)
      if (src.startsWith("^")) src = src.slice(1)
      if (src.endsWith("$")) src = src.slice(0, -1)
      const literal = src.replace(/\\(.)/g, "$1")
      const p = pushParam(params, literal)
      return `${col} ILIKE ${p}`
    }
    default:
      throw new Error(`Operador de filtro não suportado: ${op}`)
  }
}

function buildWhere(filter: Record<string, any> | undefined, params: any[]): string {
  const entries = Object.entries(filter || {})
  if (entries.length === 0) return "TRUE"
  const clauses = entries.map(([key, val]) => {
    if (key === "$or") {
      const parts = (val || []).map((f: any) => `(${buildWhere(f, params)})`)
      return parts.length ? `(${parts.join(" OR ")})` : "FALSE"
    }
    // $and existe para compor um filtro com mais de uma condição $or (um objeto JS só pode ter
    // uma chave "$or" - ex.: filtrar por turma OU turma legada E, ao mesmo tempo, por criança OU
    // criança legada). Ver GET /api/attendance.
    if (key === "$and") {
      const parts = (val || []).map((f: any) => `(${buildWhere(f, params)})`)
      return parts.length ? `(${parts.join(" AND ")})` : "TRUE"
    }
    // Compatibilidade: trata `_id` como sinônimo de `id`.
    const field = key === "_id" ? "id" : key
    assertField(field)
    const col = `(doc->>'${field}')`
    if (val === undefined) return "FALSE"
    if (val === null) return `${col} IS NULL`
    if (val instanceof Date) {
      const p = pushParam(params, val.toISOString())
      return `${col} = ${p}`
    }
    if (typeof val === "object" && !Array.isArray(val)) {
      const opClauses = Object.entries(val)
        .filter(([op]) => op !== "$options")
        .map(([op, opVal]) => buildOpClause(field, op, opVal, params))
      return opClauses.length ? opClauses.join(" AND ") : "TRUE"
    }
    const p = pushParam(params, toComparableText(val))
    return `${col} = ${p}`
  })
  return clauses.join(" AND ")
}

function buildOrderBy(sort: Record<string, number>): string {
  return Object.entries(sort)
    .map(([field, dir]) => `(doc->>'${assertField(field)}') ${Number(dir) === 1 ? "ASC" : "DESC"} NULLS LAST`)
    .join(", ")
}

class FindCursor {
  constructor(private pool: Pool, private table: string, private filter: Record<string, any>) {}
  private _sort: Record<string, number> | null = null
  private _limit: number | null = null

  sort(s: Record<string, number>) {
    this._sort = s
    return this
  }
  limit(n: number) {
    this._limit = n
    return this
  }
  async toArray(): Promise<any[]> {
    const params: any[] = []
    const where = buildWhere(this.filter, params)
    let sql = `SELECT doc FROM "${this.table}" WHERE ${where}`
    if (this._sort) sql += ` ORDER BY ${buildOrderBy(this._sort)}`
    if (this._limit) sql += ` LIMIT ${Number(this._limit)}`
    const { rows } = await this.pool.query(sql, params)
    return rows.map((r) => r.doc)
  }
}

function makeCollection(pool: Pool, table: string) {
  return {
    find(filter: Record<string, any> = {}, _opts?: any) {
      return new FindCursor(pool, table, filter)
    },
    async findOne(filter: Record<string, any> = {}) {
      const rows = await new FindCursor(pool, table, filter).limit(1).toArray()
      return rows[0] ?? null
    },
    async insertOne(doc: any) {
      const prepared = prepareForStorage(doc)
      await pool.query(`INSERT INTO "${table}" (id, doc) VALUES ($1, $2::jsonb)`, [doc.id, JSON.stringify(prepared)])
      return { insertedId: doc.id }
    },
    async insertMany(docs: any[]) {
      if (!docs.length) return { insertedIds: [] }
      const params: any[] = []
      const values = docs.map((doc) => {
        params.push(doc.id, JSON.stringify(prepareForStorage(doc)))
        return `($${params.length - 1}, $${params.length}::jsonb)`
      })
      await pool.query(`INSERT INTO "${table}" (id, doc) VALUES ${values.join(", ")}`, params)
      return { insertedIds: docs.map((d) => d.id) }
    },
    async updateOne(filter: Record<string, any>, update: { $set?: any; $unset?: any }) {
      const params: any[] = [JSON.stringify(prepareForStorage(update.$set || {}))]
      const unsetExpr = Object.keys(update.$unset || {}).map((k) => ` - '${assertField(k)}'`).join("")
      const where = buildWhere(filter, params)
      await pool.query(
        `UPDATE "${table}" SET doc = (doc${unsetExpr}) || $1::jsonb WHERE id = (SELECT id FROM "${table}" WHERE ${where} LIMIT 1)`,
        params
      )
      return { acknowledged: true }
    },
    async updateMany(filter: Record<string, any>, update: { $set?: any; $unset?: any }) {
      const params: any[] = [JSON.stringify(prepareForStorage(update.$set || {}))]
      const unsetExpr = Object.keys(update.$unset || {}).map((k) => ` - '${assertField(k)}'`).join("")
      const where = buildWhere(filter, params)
      await pool.query(`UPDATE "${table}" SET doc = (doc${unsetExpr}) || $1::jsonb WHERE ${where}`, params)
      return { acknowledged: true }
    },
    async deleteOne(filter: Record<string, any>) {
      const params: any[] = []
      const where = buildWhere(filter, params)
      const result = await pool.query(
        `DELETE FROM "${table}" WHERE id = (SELECT id FROM "${table}" WHERE ${where} LIMIT 1)`,
        params
      )
      return { acknowledged: true, deletedCount: result.rowCount ?? 0 }
    },
    async deleteMany(filter: Record<string, any>) {
      const params: any[] = []
      const where = buildWhere(filter, params)
      const result = await pool.query(`DELETE FROM "${table}" WHERE ${where}`, params)
      return { acknowledged: true, deletedCount: result.rowCount ?? 0 }
    },
    async countDocuments(filter: Record<string, any> = {}) {
      const params: any[] = []
      const where = buildWhere(filter, params)
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM "${table}" WHERE ${where}`, params)
      return rows[0]?.count ?? 0
    },
    async findOneAndUpdate(filter: Record<string, any>, update: { $set?: any; $unset?: any }, _opts?: any) {
      const params: any[] = [JSON.stringify(prepareForStorage(update.$set || {}))]
      const unsetExpr = Object.keys(update.$unset || {}).map((k) => ` - '${assertField(k)}'`).join("")
      const where = buildWhere(filter, params)
      const { rows } = await pool.query(
        `UPDATE "${table}" SET doc = (doc${unsetExpr}) || $1::jsonb WHERE id = (SELECT id FROM "${table}" WHERE ${where} LIMIT 1) RETURNING doc`,
        params
      )
      return rows[0]?.doc ?? null
    },
    async createIndex(_spec?: any, _opts?: any) {
      return null
    },
  }
}

export function createPgDb(connectionString: string) {
  const p = getPool(connectionString)
  return {
    collection(name: string) {
      if (!ALLOWED_TABLES.has(name)) {
        throw new Error(`Tabela "${name}" não existe no schema do Supabase (supabase-schema.sql).`)
      }
      return makeCollection(p, name)
    },
  }
}
