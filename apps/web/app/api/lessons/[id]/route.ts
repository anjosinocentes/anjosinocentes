import { NextRequest, NextResponse } from "next/server"
import { getDb, getOwnedClassIds, docClassId } from "@/lib/server/server-db"
import { requirePermission, isTurmaManager, forbidden } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { lessonUpdateSchema, firstZodError } from "@/lib/schemas"
import { validateLessonFiles } from "@/lib/attachment-validation"
import type { AuthedUser } from "@/lib/server/server-auth"

// Um professor (não-gestor de turmas) só pode mexer em aulas das turmas que leciona. Gestores
// (ADMIN ou quem tem a permissão "turmas") agem em qualquer turma.
async function ensureCanManageLesson(db: any, auth: AuthedUser, lesson: any): Promise<NextResponse | null> {
  if (isTurmaManager(auth)) return null
  const owned = await getOwnedClassIds(db, auth.id)
  const classId = docClassId(lesson)
  if (!classId || !owned.has(classId)) {
    return forbidden("Você só pode alterar aulas das turmas que leciona.")
  }
  return null
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PLANO_AULA)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()
    const parsed = lessonUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const filesCheck = validateLessonFiles((raw as any)?.files)
    if (!filesCheck.ok) {
      return NextResponse.json({ error: filesCheck.error }, { status: 400 })
    }
    const db = await getDb()
    const lesson = await db.collection("lessons").findOne({ id })
    if (!lesson) {
      return NextResponse.json({ error: "Plano de aula não encontrado." }, { status: 404 })
    }
    const denied = await ensureCanManageLesson(db, auth, lesson)
    if (denied) return denied

    // Não deixa um professor MOVER a aula para uma turma que não é dele (troca de classId).
    if (!isTurmaManager(auth) && raw?.classId && raw.classId !== docClassId(lesson)) {
      const owned = await getOwnedClassIds(db, auth.id)
      if (!owned.has(raw.classId)) {
        return forbidden("Você só pode vincular a aula a turmas que leciona.")
      }
    }

    await db.collection("lessons").updateOne({ id }, { $set: parsed.data })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em PUT /lessons/:id:", err)
    return NextResponse.json({ error: "Não foi possível atualizar o plano de aula. Tente novamente." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, PERMISSIONS.PLANO_AULA)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    const db = await getDb()
    const lesson = await db.collection("lessons").findOne({ id })
    if (!lesson) {
      return NextResponse.json({ error: "Plano de aula não encontrado." }, { status: 404 })
    }
    const denied = await ensureCanManageLesson(db, auth, lesson)
    if (denied) return denied

    await db.collection("lessons").deleteOne({ id })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em DELETE /lessons/:id:", err)
    return NextResponse.json({ error: "Não foi possível excluir o plano de aula. Tente novamente." }, { status: 500 })
  }
}
