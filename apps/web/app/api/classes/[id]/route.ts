import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/server/server-db"
import { requireRole } from "@/lib/server/server-auth"
import { classUpdateSchema, firstZodError } from "@/lib/schemas"

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "DIRECTOR", "COORDINATOR")
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()
    const parsed = classUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const db = await getDb()
    await db.collection("classes").updateOne(
      { id },
      { $set: parsed.data }
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em PUT /classes/:id:", err)
    return NextResponse.json({ error: "Não foi possível atualizar a turma. Tente novamente." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "DIRECTOR", "COORDINATOR")
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    const db = await getDb()
    const result = await db.collection("classes").deleteOne({ id })
    if (!result.deletedCount) {
      return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em DELETE /classes/:id:", err)
    return NextResponse.json({ error: "Não foi possível excluir a turma. Tente novamente." }, { status: 500 })
  }
}
