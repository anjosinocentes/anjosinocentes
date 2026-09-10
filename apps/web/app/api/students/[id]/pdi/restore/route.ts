import { NextRequest, NextResponse } from "next/server"
import { getDb, logAudit } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { purgeExpiredTrash } from "@/lib/server/pdi-server-utils"

// Restaura um PDI da lixeira (desfaz o soft-delete), voltando o PDI e todos os seus registros
// (acompanhamentos, evoluções) para o estado ativo. Quem tem a permissão PDIS pode restaurar.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

    const db = await getDb()
    await purgeExpiredTrash(db)

    // Só há PDI para restaurar se existir um na lixeira e nenhum ativo (evita dois PDIs na criança).
    const active = await db.collection("pdis").findOne({ studentId: id, deletedAt: null })
    if (active) {
      return NextResponse.json(
        { error: "Esta criança já possui um PDI ativo. Exclua-o antes de restaurar o da lixeira." },
        { status: 409 }
      )
    }
    const trashed = await db.collection("pdis").findOne({ studentId: id, deletedAt: { $ne: null } })
    if (!trashed) {
      return NextResponse.json({ error: "Nenhum PDI na lixeira para esta criança (ou o prazo de recuperação expirou)." }, { status: 404 })
    }

    const unset = { $unset: { deletedAt: "", deletedBy: "", deletedByName: "" } }
    await Promise.all([
      db.collection("pdis").updateMany({ studentId: id, deletedAt: { $ne: null } }, unset),
      db.collection("pdi_tracking").updateMany({ studentId: id, deletedAt: { $ne: null } }, unset),
      db.collection("pdi_evolutions").updateMany({ studentId: id, deletedAt: { $ne: null } }, unset),
    ])

    const student = await db.collection("students").findOne({ id })
    await logAudit(req, "UPDATE", "pdi", `Restaurou o PDI de ${student?.nome ?? id} da lixeira`, trashed.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em POST /students/:id/pdi/restore:", err)
    return NextResponse.json({ error: "Não foi possível restaurar o PDI. Tente novamente." }, { status: 500 })
  }
}
