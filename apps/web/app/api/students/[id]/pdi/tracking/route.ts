import { NextRequest, NextResponse } from "next/server"
import { getDb, logAudit } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { pdiTrackingSchema, firstZodError } from "@/lib/schemas"
import { PDI_AREAS, PDI_STATUSES, getPdiArea } from "@/lib/pdi-constants"
import { toTrackingView } from "@/lib/server/pdi-server-utils"

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()
    const parsed = pdiTrackingSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }

    if (!PDI_AREAS.some((a) => a.key === parsed.data.area)) {
      return NextResponse.json({ error: "Área inválida." }, { status: 400 })
    }
    if (!PDI_STATUSES.some((s) => s.key === parsed.data.status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 })
    }

    const db = await getDb()
    const pdi = await db.collection("pdis").findOne({ studentId: id })
    if (!pdi) {
      return NextResponse.json({ error: "Esta criança ainda não possui um PDI cadastrado." }, { status: 404 })
    }

    const student = await db.collection("students").findOne({ id })

    const now = new Date().toISOString()
    const doc = {
      id: crypto.randomUUID(),
      pdiId: pdi.id,
      studentId: id,
      area: parsed.data.area,
      objetivo: parsed.data.objetivo,
      descricao: parsed.data.descricao || "",
      dataInicio: parsed.data.dataInicio,
      prazo: parsed.data.prazo || null,
      status: parsed.data.status,
      responsavelId: auth.id,
      responsavelNome: auth.name,
      observacoes: parsed.data.observacoes || "",
      createdAt: now,
      updatedAt: now,
    }
    await db.collection("pdi_tracking").insertOne(doc)

    await logAudit(
      req,
      "CREATE",
      "pdi",
      `Criou o acompanhamento de ${getPdiArea(parsed.data.area).label} para ${student?.nome ?? id}`,
      pdi.id
    )

    return NextResponse.json({ tracking: toTrackingView(doc) }, { status: 201 })
  } catch (err: any) {
    console.error("Erro em POST /students/:id/pdi/tracking:", err)
    return NextResponse.json({ error: "Não foi possível criar o acompanhamento. Tente novamente." }, { status: 500 })
  }
}
