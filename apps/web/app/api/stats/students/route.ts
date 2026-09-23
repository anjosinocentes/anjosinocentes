import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc } from "@/lib/server/server-db"
import { requireAuth } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Agregados detalhados (nomes de crianças, listas de risco) são dados de RELATÓRIO: exigem a
  // permissão RELATORIOS (ADMIN sempre passa) para impedir que um Professor os obtenha chamando a
  // API direto, contornando o bloqueio do frontend.
  const canReports = auth.role === "ADMIN" || !!auth.permissions?.includes(PERMISSIONS.RELATORIOS)
  if (!canReports) {
    return NextResponse.json({ error: "Sem permissão para acessar relatórios." }, { status: 403 })
  }

  try {
    const db = await getDb()
    const studentsList = (await db.collection("students").find({}).toArray()).map(normalizeDoc)
    const attendancesList = (await db.collection("attendances").find({}).toArray()).map(normalizeDoc)

    const totalCount = studentsList.length

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const newRegistrations7d = studentsList.filter(
      (s: any) => s.created_at && new Date(s.created_at) >= sevenDaysAgo
    ).length

    const todayStr = new Date().toISOString().split("T")[0]
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
          frequencia: attendanceRate,
          motivo: "Frequência Baixa",
        }
      })
      .filter(Boolean)

    return NextResponse.json({ totalCount, newRegistrations7d, presentToday, recentStudents, riskStudents })
  } catch (err: any) {
    console.error("Erro em GET /stats/students:", err)
    return NextResponse.json({ error: "Não foi possível carregar as estatísticas. Tente novamente." }, { status: 500 })
  }
}
