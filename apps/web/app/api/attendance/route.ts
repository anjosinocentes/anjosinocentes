import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc } from "@/lib/server/server-db"
import { requirePermission, requireAuth, forbidden } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { attendanceBulkSchema, firstZodError } from "@/lib/schemas"

// Turmas que o professor leciona (professorId = id do usuário) - usado para restringir tanto a
// consulta quanto o lançamento de presença: um professor só pode ver/registrar a chamada das
// próprias turmas, nunca de turmas de outros professores. ADMIN/DIRECTOR/COORDINATOR/SECRETARY
// continuam com acesso irrestrito (não são "o professor" desta regra).
async function getTeacherClassIds(db: any, teacherId: string): Promise<string[]> {
  const classes = await db
    .collection("classes")
    .find({ $or: [{ professorId: teacherId }, { professor_id: teacherId }] })
    .toArray()
  return classes.map((c: any) => c.id)
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = req.nextUrl
    const date = searchParams.get("date")
    const classId = searchParams.get("classId")
    const studentId = searchParams.get("studentId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const db = await getDb()

    let teacherClassIds: string[] | null = null
    if (auth.role === "TEACHER") {
      teacherClassIds = await getTeacherClassIds(db, auth.id)
      if (classId && !teacherClassIds.includes(classId)) {
        return forbidden("Você só pode consultar a presença das turmas que leciona.")
      }
    }

    const query: Record<string, any> = {}
    // classId e studentId cada um precisa do próprio $or (nome de campo antigo/novo) - um objeto
    // só pode ter uma chave "$or", então com mais de uma condição elas entram dentro de um $and.
    const andConditions: Record<string, any>[] = []
    if (classId) {
      andConditions.push({ $or: [{ class_id: classId }, { classId }] })
    } else if (teacherClassIds) {
      // Sem turma especificada, um professor só pode ver as próprias turmas (nunca o sistema
      // inteiro) - restringe à lista de turmas que leciona em vez de deixar aberto.
      andConditions.push({
        $or: teacherClassIds.flatMap((id) => [{ class_id: id }, { classId: id }]),
      })
    }
    if (studentId) andConditions.push({ $or: [{ student_id: studentId }, { studentId }] })
    if (andConditions.length === 1) {
      Object.assign(query, andConditions[0])
    } else if (andConditions.length > 1) {
      query.$and = andConditions
    }
    if (date) {
      query.date = date
    } else if (startDate || endDate) {
      query.date = {}
      if (startDate) query.date.$gte = startDate
      if (endDate) query.date.$lte = endDate
    }

    const docs = await db.collection("attendances").find(query).toArray()
    return NextResponse.json({ records: docs.map(normalizeDoc) })
  } catch (err: any) {
    console.error("Erro em /attendance:", err)
    return NextResponse.json({ error: "Não foi possível processar a presença. Tente novamente." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.PRESENCA)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = await req.json()
    const parsed = attendanceBulkSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const { date, classId, records } = parsed.data
    const db = await getDb()

    if (auth.role === "TEACHER") {
      const allowedClassIds = await getTeacherClassIds(db, auth.id)
      if (!classId || !allowedClassIds.includes(classId)) {
        return forbidden("Você só pode registrar a presença das turmas que leciona.")
      }
    }

    if (records && records.length > 0) {
      const docs = records.map((r: any) => {
        const studentId = r.studentId || r.alunoId
        return {
          id: crypto.randomUUID(),
          student_id: studentId,
          studentId,
          class_id: classId || null,
          classId: classId || null,
          date,
          status: r.status,
          created_at: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }
      })
      // Substitui lançamentos anteriores da mesma turma/data para não duplicar ao salvar de novo
      if (classId && date) {
        await db.collection("attendances").deleteMany({
          date,
          $or: [{ class_id: classId }, { classId }],
        })
      }
      await db.collection("attendances").insertMany(docs)
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em /attendance:", err)
    return NextResponse.json({ error: "Não foi possível processar a presença. Tente novamente." }, { status: 500 })
  }
}
