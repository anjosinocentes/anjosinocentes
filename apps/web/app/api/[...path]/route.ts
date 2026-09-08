import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getDb, normalizeDoc, loginUser, getUserByToken, sanitizeUser } from "@/lib/server/server-db"
import { requireAuth, requireRole, requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { courseUpdateSchema, lessonSchema, firstZodError } from "@/lib/schemas"
import { getPasswordValidationError } from "@/lib/password-policy"

function normalizeText(str: string) {
  return (str || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

async function handleRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params
  const pathParts = resolvedParams.path || []
  const fullPath = pathParts.join("/")
  const method = req.method.toUpperCase()

  if (fullPath === "health") {
    return NextResponse.json({ ok: true })
  }

  // Auth: POST /auth/login (rota dedicada em app/api/auth/login cobre isso em produção;
  // mantido aqui só por compatibilidade com chamadas antigas ao catch-all)
  if (fullPath === "auth/login" && method === "POST") {
    try {
      const body = await req.json()
      const result = await loginUser(body.email, body.password)
      return NextResponse.json(result)
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Credenciais inválidas" }, { status: 401 })
    }
  }

  // Auth: GET /auth/me
  if (fullPath === "auth/me" && method === "GET") {
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    try {
      const user = await getUserByToken(token)
      return NextResponse.json({ user })
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }
  }

  const db = await getDb()

  // Students
  if (fullPath.startsWith("students")) {
    const id = pathParts[1]
    if (method === "GET") {
      const auth = await requirePermission(req, PERMISSIONS.ALUNOS)
      if (auth instanceof NextResponse) return auth
      const docs = await db.collection("students").find({}).toArray()
      return NextResponse.json({ students: docs.map(normalizeDoc) })
    }
    const auth = await requireRole(req, "DIRECTOR", "COORDINATOR", "SECRETARY")
    if (auth instanceof NextResponse) return auth
    if (method === "POST") {
      const body = await req.json()
      const newId = crypto.randomUUID()
      const newDoc = {
        id: newId,
        nome: body.nome,
        cpf: body.cpf,
        data_nascimento: body.dataNascimento || body.data_nascimento,
        dataNascimento: body.dataNascimento || body.data_nascimento,
        email: body.email || "",
        telefone: body.telefone || "",
        endereco: body.endereco || "",
        curso: body.curso || "",
        class_id: body.classId || body.class_id || null,
        class_ids: body.classIds || body.class_ids || [],
        created_at: new Date().toISOString(),
      }
      await db.collection("students").insertOne(newDoc)
      return NextResponse.json({ student: normalizeDoc(newDoc) }, { status: 201 })
    }
    if (method === "PUT" && id) {
      const body = await req.json()
      // Allowlist de campos: evita mass assignment (gravar campos arbitrários vindos do cliente).
      const allowedFields = [
        "nome", "cpf", "dataNascimento", "data_nascimento", "email", "telefone",
        "telefoneResponsavel", "endereco", "curso", "escola", "nomeResponsavel",
        "dataAcolhimento", "classId", "class_id", "classIds", "class_ids", "fotoUrl",
      ]
      const update: Record<string, any> = { updatedAt: new Date() }
      for (const key of allowedFields) {
        if (body[key] !== undefined) update[key] = body[key]
      }
      await db.collection("students").updateOne({ id }, { $set: update })
      return NextResponse.json({ success: true })
    }
    if (method === "DELETE" && id) {
      await db
        .collection("students")
        .deleteOne({ id })
      return NextResponse.json({ success: true })
    }
  }

  // Classes
  if (fullPath.startsWith("classes")) {
    const id = pathParts[1]
    if (method === "GET") {
      const auth = await requireAuth(req)
      if (auth instanceof NextResponse) return auth
      const docs = await db.collection("classes").find({}).toArray()
      return NextResponse.json({ classes: docs.map(normalizeDoc) })
    }
    const auth = await requireRole(req, "DIRECTOR", "COORDINATOR")
    if (auth instanceof NextResponse) return auth
    if (method === "POST") {
      const body = await req.json()
      const newId = crypto.randomUUID()
      const newDoc = { id: newId, ...body, created_at: new Date().toISOString() }
      await db.collection("classes").insertOne(newDoc)
      return NextResponse.json({ class: normalizeDoc(newDoc) }, { status: 201 })
    }
    if (method === "PUT" && id) {
      const body = await req.json()
      await db
        .collection("classes")
        .updateOne({ id }, { $set: body })
      return NextResponse.json({ success: true })
    }
    if (method === "DELETE" && id) {
      await db
        .collection("classes")
        .deleteOne({ id })
      return NextResponse.json({ success: true })
    }
  }

  // Users / Teachers
  if (fullPath.startsWith("users/teachers")) {
    const id = pathParts[2]
    if (method === "GET") {
      const auth = await requireRole(req, "DIRECTOR", "COORDINATOR")
      if (auth instanceof NextResponse) return auth
      const docs = await db
        .collection("users")
        .find({ role: { $ne: "STUDENT" }, id: { $ne: "admin-default-id" } })
        .toArray()
      return NextResponse.json({ teachers: docs.map(normalizeDoc) })
    }
    const auth = await requireRole(req, "DIRECTOR")
    if (auth instanceof NextResponse) return auth
    if (method === "POST") {
      const body = await req.json()
      const pwError = getPasswordValidationError(body.password)
      if (pwError) {
        return NextResponse.json({ error: pwError }, { status: 400 })
      }
      const passwordHash = await bcrypt.hash(body.password, 10)
      const newId = crypto.randomUUID()
      const { password, ...rest } = body
      const newDoc = { id: newId, ...rest, passwordHash, active: true, created_at: new Date().toISOString() }
      await db.collection("users").insertOne(newDoc)
      return NextResponse.json({ user: sanitizeUser(normalizeDoc(newDoc)) }, { status: 201 })
    }
    if (method === "PUT" && id) {
      const body = await req.json()
      const allowedFields = [
        "name", "email", "cpf", "telefone", "dataNascimento", "data_nascimento",
        "endereco", "role", "permissions", "active", "avatarUrl",
      ]
      const update: Record<string, any> = {}
      for (const key of allowedFields) {
        if (body[key] !== undefined) update[key] = body[key]
      }
      await db
        .collection("users")
        .updateOne({ id }, { $set: update })
      return NextResponse.json({ success: true })
    }
    if (method === "DELETE" && id) {
      await db
        .collection("users")
        .deleteOne({ id })
      return NextResponse.json({ success: true })
    }
  }

  // Attendance
  if (fullPath.startsWith("attendance")) {
    const auth = await requireAuth(req)
    if (auth instanceof NextResponse) return auth
    if (method === "GET") {
      const docs = await db.collection("attendances").find({}).toArray()
      return NextResponse.json({ records: docs.map(normalizeDoc) })
    }
    if (method === "POST") {
      if (!["DIRECTOR", "COORDINATOR", "SECRETARY", "TEACHER"].includes(auth.role) && auth.role !== "ADMIN") {
        return NextResponse.json({ error: "Sem permissão para executar esta ação" }, { status: 403 })
      }
      const body = await req.json()
      const { date, records } = body
      if (records && records.length > 0) {
        const docs = records.map((r: any) => ({
          id: crypto.randomUUID(),
          student_id: r.studentId || r.alunoId,
          date,
          status: r.status,
          created_at: new Date().toISOString(),
        }))
        await db.collection("attendances").insertMany(docs)
      }
      return NextResponse.json({ success: true })
    }
  }

  // Lessons
  if (fullPath.startsWith("lessons")) {
    if (method === "GET") {
      const auth = await requireAuth(req)
      if (auth instanceof NextResponse) return auth
      const docs = await db.collection("lessons").find({}).toArray()
      return NextResponse.json({ lessons: docs.map(normalizeDoc) })
    }
    if (method === "POST") {
      const auth = await requireRole(req, "DIRECTOR", "COORDINATOR", "TEACHER")
      if (auth instanceof NextResponse) return auth
      const raw = await req.json()
      const parsed = lessonSchema.safeParse(raw)
      if (!parsed.success) {
        return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
      }
      const newId = crypto.randomUUID()
      const newDoc = { id: newId, ...parsed.data, created_at: new Date().toISOString() }
      await db.collection("lessons").insertOne(newDoc)
      return NextResponse.json({ lesson: normalizeDoc(newDoc) }, { status: 201 })
    }
  }

  // Announcements: handled by the dedicated app/api/announcements routes (author resolution + sorting)

  // Courses
  if (fullPath.startsWith("courses")) {
    const id = pathParts[1]
    if (method === "GET") {
      const auth = await requireAuth(req)
      if (auth instanceof NextResponse) return auth
      const docs = await db.collection("courses").find({}).toArray()
      return NextResponse.json({ courses: docs.map(normalizeDoc) })
    }
    const auth = await requireRole(req, "DIRECTOR", "COORDINATOR")
    if (auth instanceof NextResponse) return auth
    if (method === "POST") {
      const body = await req.json()
      const newId = crypto.randomUUID()
      const newDoc = { id: newId, ...body, created_at: new Date().toISOString() }
      await db.collection("courses").insertOne(newDoc)
      return NextResponse.json({ course: normalizeDoc(newDoc) }, { status: 201 })
    }
    if (method === "PUT" && id) {
      const raw = await req.json()
      const parsed = courseUpdateSchema.safeParse(raw)
      if (!parsed.success) {
        return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
      }
      await db
        .collection("courses")
        .updateOne({ id }, { $set: parsed.data })
      return NextResponse.json({ success: true })
    }
    if (method === "DELETE" && id) {
      const result = await db.collection("courses").deleteOne({ id })
      if (!result.deletedCount) {
        return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    }
  }

  // Events
  if (fullPath.startsWith("events")) {
    if (method === "GET") {
      const auth = await requireAuth(req)
      if (auth instanceof NextResponse) return auth
      const docs = await db.collection("events").find({}).toArray()
      return NextResponse.json({ events: docs.map(normalizeDoc) })
    }
    if (method === "POST") {
      const auth = await requireRole(req, "DIRECTOR", "COORDINATOR", "SECRETARY", "TEACHER")
      if (auth instanceof NextResponse) return auth
      const body = await req.json()
      const newId = crypto.randomUUID()
      const newDoc = { id: newId, ...body, created_at: new Date().toISOString() }
      await db.collection("events").insertOne(newDoc)
      return NextResponse.json({ event: normalizeDoc(newDoc) }, { status: 201 })
    }
  }

  // Stats - agregados não sensíveis, disponíveis para qualquer usuário autenticado
  // (o Dashboard principal é acessível a todos os perfis logados)
  if (fullPath.startsWith("stats")) {
    const auth = await requireAuth(req)
    if (auth instanceof NextResponse) return auth

    const studentsList = (await db.collection("students").find({}).toArray()).map(normalizeDoc)
    const attendancesList = (await db.collection("attendances").find({}).toArray()).map(normalizeDoc)
    const todayStr = new Date().toISOString().split("T")[0]

    if (fullPath === "stats/students") {
      const totalCount = studentsList.length

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const newRegistrations7d = studentsList.filter(
        (s: any) => s.created_at && new Date(s.created_at) >= sevenDaysAgo
      ).length

      const presentToday = attendancesList.filter(
        (a: any) => a.date === todayStr && (a.status === "presente" || a.status === "PRESENT")
      ).length

      const recentStudents = studentsList
        .slice()
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map((s: any) => ({ id: s.id, name: s.nome, createdAt: s.created_at }))

      const attendancesByStudent: Record<string, { total: number; presents: number }> = {}
      attendancesList.forEach((att: any) => {
        const sId = att.student_id || att.studentId
        if (!sId) return
        if (!attendancesByStudent[sId]) attendancesByStudent[sId] = { total: 0, presents: 0 }
        attendancesByStudent[sId].total += 1
        if (att.status === "presente" || att.status === "PRESENT") attendancesByStudent[sId].presents += 1
      })

      const riskStudents = studentsList
        .map((s: any) => {
          const attStats = attendancesByStudent[s.id]
          const attendanceRate = attStats && attStats.total > 0 ? Math.round((attStats.presents / attStats.total) * 100) : null
          if (attendanceRate === null || attendanceRate >= 75) return null
          return {
            id: s.id,
            nome: s.nome,
            curso: s.curso,
            mediaNotas: null,
            frequencia: attendanceRate,
            motivo: "Frequência Baixa",
          }
        })
        .filter(Boolean)

      return NextResponse.json({ totalCount, newRegistrations7d, presentToday, recentStudents, riskStudents })
    }

    if (fullPath === "stats/reports") {
      const classesDocs = await db.collection("classes").find({}).toArray()
      const lessonsDocs = await db.collection("lessons").find({}).toArray()
      const coursesDocs = await db.collection("courses").find({}).toArray()

      const totalStudents = studentsList.length
      const activeClasses = classesDocs.filter((c: any) => c.status === "ativa").length
      const totalLessonPlans = lessonsDocs.length
      const totalAttendances = attendancesList.length

      // Agrupa por curso ignorando acento/maiúscula e usa o nome canônico cadastrado em
      // Cursos como rótulo, já que o texto livre salvo no aluno pode divergir (ex: "informatica").
      const courseCounts: Record<string, number> = {}
      const courseLabels: Record<string, string> = {}
      studentsList.forEach((s: any) => {
        const courses = s.curso ? String(s.curso).split(",").map((c: string) => c.trim()).filter(Boolean) : []
        courses.forEach((c: string) => {
          const key = normalizeText(c)
          if (!key) return
          const canonical = coursesDocs.find((cd: any) => normalizeText(cd.name) === key)
          courseCounts[key] = (courseCounts[key] || 0) + 1
          if (!courseLabels[key]) courseLabels[key] = canonical ? canonical.name : c
        })
      })
      const colors = ["#F97316", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#F59E0B"]
      const courseDistribution = Object.entries(courseCounts).map(([key, alunos], index) => ({
        nome: courseLabels[key],
        alunos,
        color: colors[index % colors.length],
      }))

      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
      const months = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        months.push({ year: d.getFullYear(), month: d.getMonth(), name: `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}` })
      }

      const presencaMensal = months.map((m) => {
        const prefix = `${m.year}-${String(m.month + 1).padStart(2, "0")}`
        const monthAtts = attendancesList.filter((a: any) => typeof a.date === "string" && a.date.startsWith(prefix))
        if (monthAtts.length === 0) return { mes: m.name, presentes: 0, ausentes: 0, semRegistro: true }
        const total = monthAtts.length
        const presentesCount = monthAtts.filter((a: any) => a.status === "presente" || a.status === "PRESENT").length
        const rate = Math.round((presentesCount / total) * 100)
        return { mes: m.name, presentes: rate, ausentes: 100 - rate, semRegistro: false }
      })

      const matriculasMensais = months.map((m) => {
        const prefix = `${m.year}-${String(m.month + 1).padStart(2, "0")}`
        const matriculas = studentsList.filter(
          (s: any) => typeof s.created_at === "string" && s.created_at.startsWith(prefix)
        ).length
        return { mes: m.name, matriculas }
      })

      return NextResponse.json({
        totalStudents,
        activeClasses,
        totalLessonPlans,
        totalAttendances,
        courseDistribution,
        presencaMensal,
        matriculasMensais,
      })
    }

    // GET /stats - main dashboard statistics
    const classesDocs = await db.collection("classes").find({}).toArray()
    const lessonsDocs = await db.collection("lessons").find({}).toArray()

    const totalAlunos = studentsList.length
    const presentesHoje = attendancesList.filter(
      (a: any) => a.date === todayStr && (a.status === "presente" || a.status === "PRESENT")
    ).length
    const aulasDoDia = lessonsDocs.filter((l: any) => (l.data || l.date) === todayStr).length
    const activeClasses = classesDocs.filter((c: any) => c.status === "ativa").length

    const today = new Date()
    const currentDay = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1))
    const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex"]
    const weeklyPresenca = weekdays.map((dia, index) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + index)
      const dateStr = d.toISOString().split("T")[0]
      const dayAtts = attendancesList.filter((a: any) => a.date === dateStr)
      const presentes = dayAtts.filter((a: any) => a.status === "presente" || a.status === "PRESENT").length
      const ausentes = dayAtts.filter((a: any) => a.status === "ausente" || a.status === "ABSENT").length
      return { dia, presentes, ausentes }
    })

    return NextResponse.json({
      stats: { totalAlunos, presentesHoje, aulasDoDia },
      weeklyPresenca,
      riskStudents: [],
      totalStudents: totalAlunos,
      activeClasses,
    })
  }

  return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
}

// Rede de segurança: qualquer erro não previsto num dos branches acima (ex.: falha de
// conexão com o banco) cai aqui em vez de vazar um stack trace para o cliente.
async function safeHandle(req: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  try {
    return await handleRequest(req, props)
  } catch (err: any) {
    console.error("Erro não tratado em /api/[...path]:", err)
    return NextResponse.json({ error: "Não foi possível processar a solicitação. Tente novamente." }, { status: 500 })
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  return safeHandle(req, props)
}

export async function POST(req: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  return safeHandle(req, props)
}

export async function PUT(req: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  return safeHandle(req, props)
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  return safeHandle(req, props)
}
