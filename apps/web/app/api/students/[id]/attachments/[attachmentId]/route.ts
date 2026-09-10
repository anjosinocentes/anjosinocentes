import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string; attachmentId: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.ALUNOS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id, attachmentId } = await props.params
    const db = await getDb()
    // Filtra por studentId também: garante que um anexo só pode ser excluído a partir do
    // cadastro da própria criança, mesmo que o attachmentId exista no banco (isolamento entre
    // crianças - nunca confiar só no attachmentId da URL).
    const result = await db.collection("student_attachments").deleteOne({ id: attachmentId, studentId: id })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em DELETE /students/:id/attachments/:attachmentId:", err)
    return NextResponse.json({ error: "Não foi possível excluir o anexo. Tente novamente." }, { status: 500 })
  }
}
