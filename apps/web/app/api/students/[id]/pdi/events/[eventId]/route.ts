import { NextRequest, NextResponse } from "next/server"
import { getDb, logAudit } from "@/lib/server/server-db"
import { requireRole } from "@/lib/server/server-auth"

// Mesma regra de sensibilidade de DELETE /pdi/evolutions/:evolutionId: histórico é o propósito
// do PDI, então só DIRECTOR (e ADMIN) corrige um marco lançado por engano.
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string; eventId: string }> }) {
  const auth = await requireRole(req, "DIRECTOR")
  if (auth instanceof NextResponse) return auth
  try {
    const { id, eventId } = await props.params
    const db = await getDb()

    const pdi = await db.collection("pdis").findOne({ studentId: id })
    if (!pdi) {
      return NextResponse.json({ error: "PDI não encontrado." }, { status: 404 })
    }
    const evento = (pdi.eventos || []).find((e: any) => e.id === eventId)
    if (!evento) {
      return NextResponse.json({ error: "Marco não encontrado." }, { status: 404 })
    }
    const student = await db.collection("students").findOne({ id })

    const eventos = (pdi.eventos || []).filter((e: any) => e.id !== eventId)
    await db.collection("pdis").updateOne({ id: pdi.id }, { $set: { eventos } })

    await logAudit(req, "DELETE", "pdi", `Excluiu o marco "${evento.titulo}" de ${student?.nome ?? id}`, pdi.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em DELETE /students/:id/pdi/events/:eventId:", err)
    return NextResponse.json({ error: "Não foi possível excluir o marco. Tente novamente." }, { status: 500 })
  }
}
