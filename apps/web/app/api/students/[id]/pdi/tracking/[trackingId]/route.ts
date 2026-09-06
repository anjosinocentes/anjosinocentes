import { NextRequest, NextResponse } from "next/server"
import { getDb, logAudit } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { pdiTrackingUpdateSchema, firstZodError } from "@/lib/schemas"
import { PDI_AREAS, PDI_STATUSES, getPdiArea } from "@/lib/pdi-constants"
import { toTrackingView } from "@/lib/server/pdi-server-utils"

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string; trackingId: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id, trackingId } = await props.params
    const raw = await req.json()
    const parsed = pdiTrackingUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }

    if (parsed.data.area && !PDI_AREAS.some((a) => a.key === parsed.data.area)) {
      return NextResponse.json({ error: "Área inválida." }, { status: 400 })
    }
    if (parsed.data.status && !PDI_STATUSES.some((s) => s.key === parsed.data.status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 })
    }

    const db = await getDb()

    // Filtra por studentId também: nunca permite editar o acompanhamento de uma criança a
    // partir do cadastro de outra, mesmo que o trackingId exista no banco.
    const existing = await db.collection("pdi_tracking").findOne({ id: trackingId, studentId: id })
    if (!existing) {
      return NextResponse.json({ error: "Acompanhamento não encontrado." }, { status: 404 })
    }

    const student = await db.collection("students").findOne({ id })

    const update: Record<string, any> = { ...parsed.data, updatedAt: new Date().toISOString() }
    if (parsed.data.status && parsed.data.status !== existing.status) {
      update.responsavelId = auth.id
      update.responsavelNome = auth.name
    }

    await db.collection("pdi_tracking").updateOne({ id: trackingId, studentId: id }, { $set: update })

    await logAudit(
      req,
      "UPDATE",
      "pdi",
      `Atualizou o acompanhamento de ${getPdiArea(existing.area).label} de ${student?.nome ?? id}`,
      existing.pdiId
    )

    const updated = await db.collection("pdi_tracking").findOne({ id: trackingId, studentId: id })
    return NextResponse.json({ tracking: toTrackingView(updated) })
  } catch (err: any) {
    console.error("Erro em PUT /students/:id/pdi/tracking/:trackingId:", err)
    return NextResponse.json({ error: "Não foi possível atualizar o acompanhamento. Tente novamente." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string; trackingId: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id, trackingId } = await props.params
    const db = await getDb()

    const existing = await db.collection("pdi_tracking").findOne({ id: trackingId, studentId: id })
    if (!existing) {
      return NextResponse.json({ error: "Acompanhamento não encontrado." }, { status: 404 })
    }

    const student = await db.collection("students").findOne({ id })

    await db.collection("pdi_tracking").deleteOne({ id: trackingId, studentId: id })

    await logAudit(
      req,
      "DELETE",
      "pdi",
      `Excluiu o acompanhamento de ${getPdiArea(existing.area).label} de ${student?.nome ?? id}`,
      existing.pdiId
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em DELETE /students/:id/pdi/tracking/:trackingId:", err)
    return NextResponse.json({ error: "Não foi possível excluir o acompanhamento. Tente novamente." }, { status: 500 })
  }
}
