import { NextRequest, NextResponse } from "next/server"
import { getDb, logAudit } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { pdiEventSchema, firstZodError } from "@/lib/schemas"
import { toEventView } from "@/lib/server/pdi-server-utils"

// Marcos gerais da linha do tempo (ex.: "Visita domiciliar", "Entrada na instituição" quando não
// há data de acolhimento cadastrada) - não pertencem a uma área acompanhada, por isso ficam
// guardados dentro do próprio documento do PDI (campo `eventos`), não em pdi_tracking/pdi_evolutions.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()
    const parsed = pdiEventSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }

    const db = await getDb()
    const pdi = await db.collection("pdis").findOne({ studentId: id })
    if (!pdi) {
      return NextResponse.json({ error: "Esta criança ainda não possui um PDI cadastrado." }, { status: 404 })
    }
    const student = await db.collection("students").findOne({ id })

    const now = new Date().toISOString()
    const evento = {
      id: crypto.randomUUID(),
      data: parsed.data.data,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || "",
      createdAt: now,
      createdBy: auth.id,
      createdByName: auth.name,
    }
    const eventos = [...(pdi.eventos || []), evento]
    await db.collection("pdis").updateOne({ id: pdi.id }, { $set: { eventos, updatedAt: now } })

    await logAudit(req, "CREATE", "pdi", `Registrou o marco "${evento.titulo}" para ${student?.nome ?? id}`, pdi.id)

    return NextResponse.json({ evento: toEventView(evento) }, { status: 201 })
  } catch (err: any) {
    console.error("Erro em POST /students/:id/pdi/events:", err)
    return NextResponse.json({ error: "Não foi possível registrar o marco. Tente novamente." }, { status: 500 })
  }
}
