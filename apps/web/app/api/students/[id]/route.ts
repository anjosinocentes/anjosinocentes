import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { ensureStudentInScope } from "@/lib/server/scope"
import { PERMISSIONS } from "@/lib/permissions"
import { studentUpdateSchema, firstZodError } from "@/lib/schemas"

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.ALUNOS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()
    const parsed = studentUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const body = parsed.data
    const db = await getDb()
    // Escopo por turma: quem não é gestor só edita crianças das próprias turmas.
    const outOfScope = await ensureStudentInScope(db, auth, id)
    if (outOfScope) return outOfScope

    if (body.cpf) {
      const cpfDigits = body.cpf.replace(/\D/g, "")
      const allCpfs = await db.collection("students").find({}, { projection: { cpf: 1, id: 1 } }).toArray()
      const isDuplicateCpf = allCpfs.some((s: any) => s.id !== id && (s.cpf || "").replace(/\D/g, "") === cpfDigits)
      if (isDuplicateCpf) {
        return NextResponse.json({ error: "Já existe outra criança cadastrada com esse CPF." }, { status: 409 })
      }
    }

    await db.collection("students").updateOne(
      { id },
      { $set: { ...body, updatedAt: new Date() } }
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em PUT /students/:id:", err)
    return NextResponse.json({ error: "Não foi possível atualizar a criança. Tente novamente." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.ALUNOS)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    if (!id) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    }
    const db = await getDb()
    const existing = await db.collection("students").findOne({ id })
    if (!existing) {
      return NextResponse.json({ error: "Criança não encontrada." }, { status: 404 })
    }
    // Escopo por turma: quem não é gestor só exclui crianças das próprias turmas.
    const outOfScope = await ensureStudentInScope(db, auth, id)
    if (outOfScope) return outOfScope
    await db.collection("students").deleteOne({ id })
    // Evita anexos e PDI órfãos apontando para uma criança que não existe mais.
    await db.collection("student_attachments").deleteMany({ studentId: id })
    await db.collection("pdis").deleteMany({ studentId: id })
    await db.collection("pdi_tracking").deleteMany({ studentId: id })
    await db.collection("pdi_evolutions").deleteMany({ studentId: id })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em DELETE /students/:id:", err)
    return NextResponse.json({ error: "Não foi possível excluir a criança. Tente novamente." }, { status: 500 })
  }
}
