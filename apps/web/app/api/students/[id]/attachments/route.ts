import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { ensureStudentInScope } from "@/lib/server/scope"
import { PERMISSIONS } from "@/lib/permissions"
import { studentAttachmentUploadSchema, firstZodError } from "@/lib/schemas"
import { validateAttachmentFiles } from "@/lib/attachment-validation"
import { getFileExtension, MAX_STUDENT_ATTACHMENTS, MAX_STUDENT_ATTACHMENT_FILE_BYTES } from "@/lib/attachment-utils"

// Nunca reenvia o _id interno do Mongo - só os campos que compõem o "documento" de anexo
// descrito no requisito (id, criança, nome original, tipo, extensão, tamanho, data).
function toAttachmentView(doc: any) {
  return {
    id: doc.id,
    studentId: doc.studentId,
    name: doc.name,
    type: doc.type,
    extension: doc.extension,
    size: doc.size,
    data: doc.data,
    uploadedBy: doc.uploadedBy || null,
    createdAt: doc.createdAt,
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  // Anexos de crianças podem conter documentos pessoais: exige a permissão "alunos".
  const auth = await requirePermission(req, PERMISSIONS.ALUNOS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const db = await getDb()
    const outOfScope = await ensureStudentInScope(db, auth, id)
    if (outOfScope) return outOfScope
    const docs = await db
      .collection("student_attachments")
      .find({ studentId: id })
      .sort({ createdAt: 1 })
      .toArray()
    return NextResponse.json({ attachments: docs.map(toAttachmentView) })
  } catch (err: any) {
    console.error("Erro em GET /students/:id/attachments:", err)
    return NextResponse.json({ error: "Não foi possível carregar os anexos." }, { status: 500 })
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.ALUNOS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()
    const parsed = studentAttachmentUploadSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }

    const db = await getDb()
    const outOfScope = await ensureStudentInScope(db, auth, id)
    if (outOfScope) return outOfScope

    const student = await db.collection("students").findOne({
      id,
    })
    if (!student) {
      return NextResponse.json({ error: "Criança não encontrada." }, { status: 404 })
    }

    const existingCount = await db.collection("student_attachments").countDocuments({ studentId: id })
    const remaining = MAX_STUDENT_ATTACHMENTS - existingCount

    if (remaining <= 0) {
      return NextResponse.json(
        {
          error: `Esta criança já possui ${existingCount} anexos. O limite de ${MAX_STUDENT_ATTACHMENTS} arquivos foi atingido.`,
        },
        { status: 409 }
      )
    }

    if (parsed.data.attachments.length > remaining) {
      return NextResponse.json(
        {
          error: `Esta criança já possui ${existingCount} anexo(s). Você pode adicionar apenas mais ${remaining} arquivo${remaining === 1 ? "" : "s"}.`,
        },
        { status: 409 }
      )
    }

    const fileCheck = validateAttachmentFiles(parsed.data.attachments, MAX_STUDENT_ATTACHMENT_FILE_BYTES)
    if (!fileCheck.ok) {
      return NextResponse.json({ error: fileCheck.error }, { status: 400 })
    }

    const now = new Date().toISOString()
    const newDocs = parsed.data.attachments.map((att) => ({
      id: crypto.randomUUID(),
      studentId: id,
      name: att.name,
      type: att.type || "",
      extension: getFileExtension(att.name),
      size: att.size || 0,
      data: att.data,
      uploadedBy: auth.id,
      createdAt: now,
    }))

    await db.collection("student_attachments").insertMany(newDocs)
    return NextResponse.json({ attachments: newDocs.map(toAttachmentView) }, { status: 201 })
  } catch (err: any) {
    console.error("Erro em POST /students/:id/attachments:", err)
    return NextResponse.json({ error: "Não foi possível enviar os anexos. Tente novamente." }, { status: 500 })
  }
}
