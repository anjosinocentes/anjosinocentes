import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/server/server-db"
import { requireRole } from "@/lib/server/server-auth"
import { validateAttachmentsServerSide } from "@/lib/attachment-validation"
import { announcementUpdateSchema, firstZodError } from "@/lib/schemas"

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "DIRECTOR", "COORDINATOR", "SECRETARY")
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()

    const parsed = announcementUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const body = parsed.data

    const attachmentCheck = validateAttachmentsServerSide(body.attachments)
    if (!attachmentCheck.ok) {
      return NextResponse.json({ error: attachmentCheck.error }, { status: 400 })
    }

    const db = await getDb()
    await db.collection("announcements").updateOne(
      { id },
      { $set: { ...body, updatedAt: new Date().toISOString() } }
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em PUT /announcements/:id:", err)
    return NextResponse.json({ error: "Não foi possível atualizar o aviso. Tente novamente." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "DIRECTOR", "COORDINATOR", "SECRETARY")
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    const db = await getDb()
    const result = await db.collection("announcements").deleteOne({ id })
    if (!result.deletedCount) {
      return NextResponse.json({ error: "Aviso não encontrado." }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em DELETE /announcements/:id:", err)
    return NextResponse.json({ error: "Não foi possível excluir o aviso. Tente novamente." }, { status: 500 })
  }
}
