import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { eventUpdateSchema, firstZodError } from "@/lib/schemas"

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.CALENDARIO)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()
    const parsed = eventUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const db = await getDb()
    await db.collection("events").updateOne(
      { id },
      { $set: parsed.data }
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em PUT /events/:id:", err)
    return NextResponse.json({ error: "Não foi possível atualizar o evento. Tente novamente." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.CALENDARIO)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    const db = await getDb()
    const result = await db.collection("events").deleteOne({ id })
    if (!result.deletedCount) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em DELETE /events/:id:", err)
    return NextResponse.json({ error: "Não foi possível excluir o evento. Tente novamente." }, { status: 500 })
  }
}
