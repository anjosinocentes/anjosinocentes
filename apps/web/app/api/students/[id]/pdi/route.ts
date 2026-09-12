import { NextRequest, NextResponse } from "next/server"
import { getDb, logAudit } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { ensureStudentInScope } from "@/lib/server/scope"
import { PERMISSIONS } from "@/lib/permissions"
import { pdiInitialSchema, pdiUpdateSchema, firstZodError } from "@/lib/schemas"
import { validateAttachmentFiles } from "@/lib/attachment-validation"
import { PDI_AREAS, MAX_PDI_EVOLUTION_ATTACHMENT_BYTES, getPdiArea } from "@/lib/pdi-constants"
import { toPdiView, toTrackingView, toEvolutionView, purgeExpiredTrash, PDI_TRASH_TTL_DAYS } from "@/lib/server/pdi-server-utils"

async function findStudent(db: any, id: string) {
  return db.collection("students").findOne({
    id,
  })
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    const db = await getDb()
    const outOfScope = await ensureStudentInScope(db, auth, id)
    if (outOfScope) return outOfScope
    // Valida no servidor que a criança existe antes de expor o PDI (evita sondar IDs arbitrários).
    // A autorização de acesso é a permissão PDIS (verificada acima por requirePermission).
    const student = await findStudent(db, id)
    if (!student) {
      return NextResponse.json({ error: "Criança não encontrada." }, { status: 404 })
    }
    const pdi = await db.collection("pdis").findOne({ studentId: id, deletedAt: null })
    if (!pdi) {
      return NextResponse.json({ pdi: null, tracking: [], evolutions: [] })
    }

    const [tracking, evolutions] = await Promise.all([
      db.collection("pdi_tracking").find({ studentId: id, deletedAt: null }).sort({ area: 1 }).toArray(),
      db.collection("pdi_evolutions").find({ studentId: id, deletedAt: null }).sort({ data: -1, createdAt: -1 }).toArray(),
    ])

    return NextResponse.json({
      pdi: toPdiView(pdi),
      tracking: tracking.map(toTrackingView),
      evolutions: evolutions.map(toEvolutionView),
    })
  } catch (err: any) {
    console.error("Erro em GET /students/:id/pdi:", err)
    return NextResponse.json({ error: "Não foi possível carregar o PDI." }, { status: 500 })
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()
    const parsed = pdiInitialSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }

    const db = await getDb()
    const outOfScope = await ensureStudentInScope(db, auth, id)
    if (outOfScope) return outOfScope

    const student = await findStudent(db, id)
    if (!student) {
      return NextResponse.json({ error: "Criança não encontrada." }, { status: 404 })
    }

    const existing = await db.collection("pdis").findOne({ studentId: id, deletedAt: null })
    if (existing) {
      return NextResponse.json({ error: "Esta criança já possui um PDI cadastrado." }, { status: 409 })
    }

    if (parsed.data.attachments && parsed.data.attachments.length > 0) {
      const fileCheck = validateAttachmentFiles(parsed.data.attachments, MAX_PDI_EVOLUTION_ATTACHMENT_BYTES)
      if (!fileCheck.ok) {
        return NextResponse.json({ error: fileCheck.error }, { status: 400 })
      }
    }

    const validAreaKeys = new Set(PDI_AREAS.map((a) => a.key as string))
    const areas = (parsed.data.areas || []).filter((a) => validAreaKeys.has(a))

    const now = new Date().toISOString()
    const pdiId = crypto.randomUUID()
    const pdiDoc = {
      id: pdiId,
      studentId: id,
      situacaoInicial: parsed.data.situacaoInicial,
      objetivosIniciais: parsed.data.objetivosIniciais || "",
      observacoesIniciais: parsed.data.observacoesIniciais || "",
      attachments: parsed.data.attachments || [],
      createdAt: now,
      createdBy: auth.id,
      createdByName: auth.name,
      updatedAt: now,
    }
    await db.collection("pdis").insertOne(pdiDoc)

    if (areas.length > 0) {
      const trackingDocs = areas.map((area) => ({
        id: crypto.randomUUID(),
        pdiId,
        studentId: id,
        area,
        objetivo: `Acompanhar a área de ${getPdiArea(area).label.toLowerCase()}`,
        descricao: "",
        dataInicio: now.slice(0, 10),
        prazo: null,
        status: "acompanhamento",
        responsavelId: auth.id,
        responsavelNome: auth.name,
        observacoes: "",
        createdAt: now,
        updatedAt: now,
      }))
      await db.collection("pdi_tracking").insertMany(trackingDocs)
    }

    await logAudit(req, "CREATE", "pdi", `Criou o PDI de ${student.nome}`, pdiId)

    return NextResponse.json({ pdi: toPdiView(pdiDoc) }, { status: 201 })
  } catch (err: any) {
    console.error("Erro em POST /students/:id/pdi:", err)
    return NextResponse.json({ error: "Não foi possível criar o PDI. Tente novamente." }, { status: 500 })
  }
}

// Corrige o histórico inicial depois de criado (ex.: erro de digitação) - não mexe em
// tracking/evolutions/eventos, que têm suas próprias rotas e regras de edição.
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()
    const parsed = pdiUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }

    const db = await getDb()
    const outOfScope = await ensureStudentInScope(db, auth, id)
    if (outOfScope) return outOfScope
    const pdi = await db.collection("pdis").findOne({ studentId: id, deletedAt: null })
    if (!pdi) {
      return NextResponse.json({ error: "Esta criança ainda não possui um PDI cadastrado." }, { status: 404 })
    }
    const student = await db.collection("students").findOne({ id })

    const now = new Date().toISOString()
    await db.collection("pdis").updateOne(
      { id: pdi.id },
      { $set: { ...parsed.data, updatedAt: now, updatedBy: auth.id, updatedByName: auth.name } }
    )

    await logAudit(req, "UPDATE", "pdi", `Editou o histórico inicial do PDI de ${student?.nome ?? id}`, pdi.id)

    return NextResponse.json({ pdi: toPdiView({ ...pdi, ...parsed.data, updatedAt: now, updatedBy: auth.id, updatedByName: auth.name }) })
  } catch (err: any) {
    console.error("Erro em PUT /students/:id/pdi:", err)
    return NextResponse.json({ error: "Não foi possível atualizar o PDI. Tente novamente." }, { status: 500 })
  }
}

// Exclui o PDI da criança POR COMPLETO: o documento do PDI (que inclui os eventos/marcos
// embutidos) e todos os registros relacionados (acompanhamentos e evoluções). Ação destrutiva
// e irreversível, por isso restrita a ADMIN/DIRECTOR (a permissão PDIS por si só, que também
// pode ser dada a professores/coordenadores, não basta para apagar o PDI inteiro).
// Exclusão RECUPERÁVEL (soft-delete): quem tem a permissão PDIS pode excluir, mas o PDI não é
// apagado de imediato - fica marcado com `deletedAt` e some das telas. Pode ser restaurado pela
// Lixeira em até 7 dias (ver PDI_TRASH_TTL_DAYS e a rota /pdis/trash); depois disso é removido
// definitivamente pela limpeza oportunista (purgeExpiredTrash).
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

    const db = await getDb()
    const outOfScope = await ensureStudentInScope(db, auth, id)
    if (outOfScope) return outOfScope
    await purgeExpiredTrash(db)
    const pdi = await db.collection("pdis").findOne({ studentId: id, deletedAt: null })
    if (!pdi) {
      return NextResponse.json({ error: "Esta criança não possui um PDI cadastrado." }, { status: 404 })
    }
    const student = await db.collection("students").findOne({ id })

    const deletedAt = new Date().toISOString()
    const mark = { deletedAt, deletedBy: auth.id, deletedByName: auth.name }
    // Marca o PDI e todos os registros relacionados (mesmo lote) como excluídos, sem apagar.
    await Promise.all([
      db.collection("pdis").updateOne({ id: pdi.id }, { $set: mark }),
      db.collection("pdi_tracking").updateMany({ studentId: id, deletedAt: null }, { $set: mark }),
      db.collection("pdi_evolutions").updateMany({ studentId: id, deletedAt: null }, { $set: mark }),
    ])

    await logAudit(req, "DELETE", "pdi", `Excluiu o PDI de ${student?.nome ?? id} (recuperável por ${PDI_TRASH_TTL_DAYS} dias)`, pdi.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em DELETE /students/:id/pdi:", err)
    return NextResponse.json({ error: "Não foi possível excluir o PDI. Tente novamente." }, { status: 500 })
  }
}
