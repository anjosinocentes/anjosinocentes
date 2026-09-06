import crypto from "crypto"
import { getDb } from "./server-db"

const TOKEN_BYTES = 32
const TOKEN_TTL_MINUTES = 15
const MAX_REQUESTS_PER_EMAIL = 3
const MAX_REQUESTS_PER_IP = 10
const RATE_LIMIT_WINDOW_MINUTES = 15

let indexesEnsured = false

// Garante os índices uma única vez por processo: TTL para limpar registros expirados
// automaticamente, e índices para as consultas de rate limit.
//
// O rate limit é contado numa coleção separada (`password_reset_attempts`), não na
// `password_resets` - essa última tem seus registros não-usados apagados a cada nova
// solicitação (regra "só o último link vale"), o que zeraria a contagem de tentativas
// se ela fosse usada para as duas coisas ao mesmo tempo.
async function ensureIndexes() {
  if (indexesEnsured) return
  const db = await getDb()
  await Promise.all([
    db.collection("password_resets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("password_resets").createIndex({ userId: 1 }),
    db.collection("password_reset_attempts").createIndex({ createdAt: 1 }, { expireAfterSeconds: RATE_LIMIT_WINDOW_MINUTES * 60 }),
    db.collection("password_reset_attempts").createIndex({ email: 1, createdAt: 1 }),
    db.collection("password_reset_attempts").createIndex({ ip: 1, createdAt: 1 }),
  ])
  indexesEnsured = true
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

// Limpeza dos registros expirados. Como os índices TTL do Mongo não têm efeito no adaptador
// Postgres (pg-collection), removemos manualmente, de forma oportunista, a cada solicitação:
//  - tokens de redefinição já vencidos (expiresAt no passado);
//  - tentativas de rate limit mais antigas que a janela (não contam mais).
// Tabelas pequenas e deleção idempotente, então rodar a cada request é barato e seguro.
export async function cleanupExpiredResets(): Promise<void> {
  try {
    const db = await getDb()
    const now = new Date()
    const attemptsCutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000)
    await Promise.all([
      db.collection("password_resets").deleteMany({ expiresAt: { $lt: now } }),
      db.collection("password_reset_attempts").deleteMany({ createdAt: { $lt: attemptsCutoff } }),
    ])
  } catch (err) {
    // Limpeza é best-effort: uma falha aqui não deve impedir o fluxo de redefinição.
    console.error("Falha ao limpar registros de redefinição expirados:", err)
  }
}

export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase()
}

// true = pode seguir com o pedido, false = estourou o limite (spam/abuso).
// Registra a tentativa (contando mesmo quando o e-mail não existe no sistema, para não
// vazar essa informação através do próprio comportamento do rate limit).
export async function checkRateLimit(email: string, ip: string): Promise<boolean> {
  await ensureIndexes()
  await cleanupExpiredResets()
  const db = await getDb()
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000)

  const [byEmail, byIp] = await Promise.all([
    db.collection("password_reset_attempts").countDocuments({ email, createdAt: { $gte: since } }),
    db.collection("password_reset_attempts").countDocuments({ ip, createdAt: { $gte: since } }),
  ])

  const withinLimit = byEmail < MAX_REQUESTS_PER_EMAIL && byIp < MAX_REQUESTS_PER_IP
  await db.collection("password_reset_attempts").insertOne({ id: crypto.randomUUID(), email, ip, createdAt: new Date() })
  return withinLimit
}

// Cria um token novo para o usuário, invalidando qualquer token anterior ainda não usado
// (regra: só o link mais recente continua válido).
export async function createPasswordResetToken(userId: string, requesterEmail: string, requesterIp: string): Promise<string> {
  await ensureIndexes()
  const db = await getDb()

  await db.collection("password_resets").deleteMany({ userId, usedAt: null })

  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex")
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)

  await db.collection("password_resets").insertOne({
    id: crypto.randomUUID(),
    userId,
    tokenHash: hashToken(token),
    requesterEmail,
    requesterIp,
    expiresAt,
    usedAt: null,
    createdAt: new Date(),
  })

  return token
}

export type ResetTokenStatus = "valid" | "invalid" | "expired" | "used"

export async function checkResetToken(token: string): Promise<{ status: ResetTokenStatus; userId?: string }> {
  if (!token || typeof token !== "string") return { status: "invalid" }

  const db = await getDb()
  const record = await db.collection("password_resets").findOne({ tokenHash: hashToken(token) })

  if (!record) return { status: "invalid" }
  if (record.usedAt) return { status: "used" }
  if (new Date(record.expiresAt) < new Date()) return { status: "expired" }

  return { status: "valid", userId: record.userId }
}

// Consome o token (marca como usado) e devolve o userId associado, ou null se o
// token não for mais válido no exato momento da troca de senha (checagem final,
// não confia só na validação feita antes pelo usuário).
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const db = await getDb()
  const tokenHash = hashToken(token)
  const now = new Date()

  const result = await db.collection("password_resets").findOneAndUpdate(
    { tokenHash, usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { returnDocument: "after" }
  )

  return result?.userId ?? null
}
