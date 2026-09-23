import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc, getOwnedClassIds } from "@/lib/server/server-db"
import { requireAuth, requirePermission, isTurmaManager, forbidden } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { lessonSchema, firstZodError } from "@/lib/schemas"
import { validateLessonFiles } from "@/lib/attachment-validation"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    const docs = await db.collection("lessons").find({}).toArray()
    return NextResponse.json({ lessons: docs.map(normalizeDoc) })
  } catch (err: any) {
    console.error("Erro em GET /lessons:", err)
    return NextResponse.json({ error: "Não foi possível carregar os planos de aula. Tente novamente." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.PLANO_AULA)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = await req.json()
    const parsed = lessonSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const filesCheck = validateLessonFiles((raw as any)?.files)
    if (!filesCheck.ok) {
      return NextResponse.json({ error: filesCheck.error }, { status: 400 })
    }
    const db = await getDb()

    // Dono da turma: um professor (não-gestor) só cria aula para turmas que leciona - mesma
    // regra que a Presença já aplica. Gestores (ADMIN/permissão "turmas") criam em qualquer turma.
    const classId = (raw?.classId ?? raw?.class_id ?? null) as string | null
    if (!isTurmaManager(auth)) {
      const owned = await getOwnedClassIds(db, auth.id)
      if (!classId || !owned.has(classId)) {
        return forbidden("Você só pode criar aulas para turmas que leciona.")
      }
    }

    const newId = crypto.randomUUID()
    const newDoc = { id: newId, ...parsed.data, created_at: new Date().toISOString() }
    await db.collection("lessons").insertOne(newDoc)
    return NextResponse.json({ lesson: normalizeDoc(newDoc) }, { status: 201 })
  } catch (err: any) {
    console.error("Erro em POST /lessons:", err)
    return NextResponse.json({ error: "Não foi possível criar o plano de aula. Tente novamente." }, { status: 500 })
  }
}
