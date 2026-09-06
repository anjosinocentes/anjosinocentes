import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/server/server-db"
import { requireAuth } from "@/lib/server/server-auth"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    const totalAlunos = await db.collection("students").countDocuments()
    const activeClasses = await db.collection("classes").countDocuments({ status: "ativa" })
    return NextResponse.json({
      stats: { totalAlunos, presentesHoje: 0, aulasDoDia: 0 },
      weeklyPresenca: [],
      riskStudents: [],
      totalStudents: totalAlunos,
      activeClasses,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
