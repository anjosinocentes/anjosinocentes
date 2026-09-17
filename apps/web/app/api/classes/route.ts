import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc } from "@/lib/server/server-db"
import { requirePermission, requireAuth } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { classSchema, firstZodError } from "@/lib/schemas"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    const [classDocs, studentDocs] = await Promise.all([
      db.collection("classes").find({}).toArray(),
      db.collection("students").find({}, { projection: { classId: 1, class_id: 1, classIds: 1, class_ids: 1 } }).toArray(),
    ])

    const countByClass = new Map<string, number>()
    for (const s of studentDocs) {
      const ids: string[] = []
      if (s.classId) ids.push(s.classId)
      if (s.class_id && s.class_id !== s.classId) ids.push(s.class_id)
      for (const id of (s.classIds || s.class_ids || [])) {
        if (!ids.includes(id)) ids.push(id)
      }
      for (const id of ids) {
        countByClass.set(id, (countByClass.get(id) || 0) + 1)
      }
    }

    const classes = classDocs.map(doc => {
      const normalized = normalizeDoc(doc)
      normalized.alunosMatriculados = countByClass.get(normalized.id) || 0
      normalized.alunos_matriculados = normalized.alunosMatriculados
      return normalized
    })
    return NextResponse.json({ classes })
  } catch (err: any) {
    console.error("Erro em GET /classes:", err)
    return NextResponse.json({ error: "Não foi possível carregar as turmas." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.TURMAS)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = await req.json()
    const parsed = classSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const db = await getDb()
    const newId = crypto.randomUUID()
    const newDoc = { id: newId, ...parsed.data, created_at: new Date().toISOString() }
    await db.collection("classes").insertOne(newDoc)
    return NextResponse.json({ class: normalizeDoc(newDoc) }, { status: 201 })
  } catch (err: any) {
    console.error("Erro em POST /classes:", err)
    return NextResponse.json({ error: "Não foi possível criar a turma. Tente novamente." }, { status: 500 })
  }
}
