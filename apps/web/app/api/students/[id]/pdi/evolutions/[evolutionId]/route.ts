import { NextRequest, NextResponse } from "next/server"
import { getDb, logAudit } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { getPdiArea } from "@/lib/pdi-constants"

// Excluir um registro de evolução é mais sensível que os outros CRUDs do PDI - o histórico
// é o próprio propósito da funcionalidade, então só DIRECTOR (e ADMIN, que o requireRole
// sempre libera) pode corrigir um lançamento equivocado, não qualquer um com a permissão "pdis".
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string; evolutionId: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id, evolutionId } = await props.params
    const db = await getDb()

    const existing = await db.collection("pdi_evolutions").findOne({ id: evolutionId, studentId: id })
    if (!existing) {
      return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 })
    }

    const student = await db.collection("students").findOne({ id })

    await db.collection("pdi_evolutions").deleteOne({ id: evolutionId, studentId: id })

    await logAudit(
      req,
      "DELETE",
      "pdi",
      `Excluiu um registro de evolução (${getPdiArea(existing.area).label}) de ${student?.nome ?? id}`,
      existing.pdiId
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em DELETE /students/:id/pdi/evolutions/:evolutionId:", err)
    return NextResponse.json({ error: "Não foi possível excluir o registro. Tente novamente." }, { status: 500 })
  }
}
