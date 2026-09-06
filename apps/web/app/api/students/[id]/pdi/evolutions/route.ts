import { NextRequest, NextResponse } from "next/server"
import { getDb, logAudit } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { pdiEvolutionSchema, firstZodError } from "@/lib/schemas"
import { validateAttachmentFiles } from "@/lib/attachment-validation"
import { PDI_AREAS, PDI_STATUSES, MAX_PDI_EVOLUTION_ATTACHMENT_BYTES, getPdiArea, getPdiStatus } from "@/lib/pdi-constants"
import { toEvolutionView } from "@/lib/server/pdi-server-utils"

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const { searchParams } = req.nextUrl
    const area = searchParams.get("area")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const query: Record<string, any> = { studentId: id }
    if (area) query.area = area
    if (startDate || endDate) {
      query.data = {}
      if (startDate) query.data.$gte = startDate
      if (endDate) query.data.$lte = endDate
    }

    const db = await getDb()
    const docs = await db.collection("pdi_evolutions").find(query).sort({ data: -1, createdAt: -1 }).toArray()
    return NextResponse.json({ evolutions: docs.map(toEvolutionView) })
  } catch (err: any) {
    console.error("Erro em GET /students/:id/pdi/evolutions:", err)
    return NextResponse.json({ error: "Não foi possível carregar os registros de evolução." }, { status: 500 })
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()
    const parsed = pdiEvolutionSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }

    if (!PDI_AREAS.some((a) => a.key === parsed.data.area)) {
      return NextResponse.json({ error: "Área inválida." }, { status: 400 })
    }
    if (!PDI_STATUSES.some((s) => s.key === parsed.data.status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 })
    }

    if (parsed.data.attachments && parsed.data.attachments.length > 0) {
      const fileCheck = validateAttachmentFiles(parsed.data.attachments, MAX_PDI_EVOLUTION_ATTACHMENT_BYTES)
      if (!fileCheck.ok) {
        return NextResponse.json({ error: fileCheck.error }, { status: 400 })
      }
    }

    const db = await getDb()
    const pdi = await db.collection("pdis").findOne({ studentId: id })
    if (!pdi) {
      return NextResponse.json(
        { error: "Esta criança ainda não possui um PDI cadastrado. Crie o PDI antes de registrar uma evolução." },
        { status: 404 }
      )
    }

    const student = await db.collection("students").findOne({ id })

    const now = new Date().toISOString()
    const evolutionDoc = {
      id: crypto.randomUUID(),
      pdiId: pdi.id,
      studentId: id,
      area: parsed.data.area,
      status: parsed.data.status,
      data: parsed.data.data,
      relato: parsed.data.relato,
      proximosPassos: parsed.data.proximosPassos || "",
      responsavelId: auth.id,
      responsavelNome: auth.name,
      attachments: parsed.data.attachments || [],
      createdAt: now,
    }
    await db.collection("pdi_evolutions").insertOne(evolutionDoc)

    // Mantém o "Acompanhamento" da área sempre coerente com o último registro: cria um se a
    // área ainda não tinha um, ou só atualiza status/responsável/data se já existia.
    const existingTracking = await db.collection("pdi_tracking").findOne({ studentId: id, area: parsed.data.area })
    if (existingTracking) {
      await db.collection("pdi_tracking").updateOne(
        { id: existingTracking.id },
        { $set: { status: parsed.data.status, responsavelId: auth.id, responsavelNome: auth.name, updatedAt: now } }
      )
    } else {
      await db.collection("pdi_tracking").insertOne({
        id: crypto.randomUUID(),
        pdiId: pdi.id,
        studentId: id,
        area: parsed.data.area,
        objetivo: `Acompanhar a área de ${getPdiArea(parsed.data.area).label.toLowerCase()}`,
        descricao: "",
        dataInicio: parsed.data.data,
        prazo: null,
        status: parsed.data.status,
        responsavelId: auth.id,
        responsavelNome: auth.name,
        observacoes: "",
        createdAt: now,
        updatedAt: now,
      })
    }

    await db.collection("pdis").updateOne({ id: pdi.id }, { $set: { updatedAt: now } })

    await logAudit(
      req,
      "CREATE",
      "pdi",
      `Registrou evolução (${getPdiArea(parsed.data.area).label} · ${getPdiStatus(parsed.data.status).label}) de ${student?.nome ?? id}`,
      pdi.id
    )

    return NextResponse.json({ evolution: toEvolutionView(evolutionDoc) }, { status: 201 })
  } catch (err: any) {
    console.error("Erro em POST /students/:id/pdi/evolutions:", err)
    return NextResponse.json({ error: "Não foi possível registrar a evolução. Tente novamente." }, { status: 500 })
  }
}
