import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc } from "@/lib/server/server-db"
import { requireAuth } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"

function normalizeText(str: string) {
  return (str || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Mesma regra do /stats/students: agregados detalhados de relatório exigem a permissão
  // RELATORIOS (ADMIN sempre passa).
  const canReports = auth.role === "ADMIN" || !!auth.permissions?.includes(PERMISSIONS.RELATORIOS)
  if (!canReports) {
    return NextResponse.json({ error: "Sem permissão para acessar relatórios." }, { status: 403 })
  }

  try {
    const db = await getDb()
    const studentsList = (await db.collection("students").find({}).toArray()).map(normalizeDoc)
    const attendancesList = (await db.collection("attendances").find({}).toArray()).map(normalizeDoc)
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
  } catch (err: any) {
    console.error("Erro em GET /stats/reports:", err)
    return NextResponse.json({ error: "Não foi possível carregar os relatórios. Tente novamente." }, { status: 500 })
  }
}
