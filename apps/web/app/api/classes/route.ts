import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc } from "@/lib/server/server-db"
import { requireAuth, requireRole } from "@/lib/server/server-auth"
import { classSchema, firstZodError } from "@/lib/schemas"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    const docs = await db.collection("classes").find({}).toArray()
    const classes = docs.map(normalizeDoc)
    return NextResponse.json({ classes })
  } catch (err: any) {
    console.error("Erro em GET /classes:", err)
    return NextResponse.json({ error: "Não foi possível carregar as turmas." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "DIRECTOR", "COORDINATOR")
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
