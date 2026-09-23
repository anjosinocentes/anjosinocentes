import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { courseUpdateSchema, firstZodError } from "@/lib/schemas"

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.OFICINAS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()
    const parsed = courseUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const db = await getDb()
    await db.collection("courses").updateOne({ id }, { $set: parsed.data })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em PUT /courses/:id:", err)
    return NextResponse.json({ error: "Não foi possível atualizar a oficina. Tente novamente." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.OFICINAS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    const db = await getDb()
    const result = await db.collection("courses").deleteOne({ id })
    if (!result.deletedCount) {
      return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em DELETE /courses/:id:", err)
    return NextResponse.json({ error: "Não foi possível excluir a oficina. Tente novamente." }, { status: 500 })
  }
}
