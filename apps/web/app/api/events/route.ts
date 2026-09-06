import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc } from "@/lib/server/server-db"
import { requireAuth, requireRole } from "@/lib/server/server-auth"
import { eventSchema, firstZodError } from "@/lib/schemas"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    const docs = await db.collection("events").find({}).toArray()
    // Eventos privados só aparecem para quem os criou; públicos (ou legados, sem o campo) para todos.
    const events = docs
      .map(normalizeDoc)
      .filter((e: any) => e.visibilidade !== "privado" || e.ownerId === auth.id)
    return NextResponse.json({ events })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "DIRECTOR", "COORDINATOR", "SECRETARY", "TEACHER")
  if (auth instanceof NextResponse) return auth
  try {
    const raw = await req.json()
    const parsed = eventSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const db = await getDb()
    const newId = crypto.randomUUID()
    // Dono e visibilidade são definidos no servidor (não confiar no cliente para o ownerId).
    const visibilidade = (raw?.visibilidade === "privado") ? "privado" : "publico"
    const newDoc = {
      id: newId,
      ...parsed.data,
      visibilidade,
      ownerId: auth.id,
      ownerName: auth.name,
      created_at: new Date().toISOString(),
    }
    await db.collection("events").insertOne(newDoc)
    return NextResponse.json({ event: normalizeDoc(newDoc) }, { status: 201 })
  } catch (err: any) {
    console.error("Erro em POST /events:", err)
    return NextResponse.json({ error: "Não foi possível criar o evento. Tente novamente." }, { status: 500 })
  }
}
