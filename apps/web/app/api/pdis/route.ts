import { NextRequest, NextResponse } from "next/server"
import { getDb, getOwnedClassIds } from "@/lib/server/server-db"
import { requirePermission, isTurmaManager } from "@/lib/server/server-auth"
import { studentClassIds } from "@/lib/server/scope"
import { PERMISSIONS } from "@/lib/permissions"
import { getPdiArea } from "@/lib/pdi-constants"

// Dados agregados para a Central de PDIs (dashboard): um resumo por criança com PDI, já com
// o status atual de cada área acompanhada e a data do último registro de evolução. Os
// indicadores/filtros da tela são todos calculados no cliente a partir desta lista.
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    // Escopo por turma: gestor de turmas vê todas as crianças; um professor só as das suas turmas.
    let allowedStudentIds: Set<string> | null = null
    if (!isTurmaManager(auth)) {
      const owned = await getOwnedClassIds(db, auth.id)
      const students = await db
        .collection("students")
        .find({}, { projection: { id: 1, classId: 1, class_id: 1, classIds: 1, class_ids: 1 } })
        .toArray()
      allowedStudentIds = new Set(
        (students as any[]).filter((s) => studentClassIds(s).some((c) => owned.has(c))).map((s) => s.id)
      )
    }
    // Ignora PDIs (e registros) na lixeira - só entram os ativos (deletedAt ausente/nulo).
    const [pdisList, trackingList, evolutionsList] = await Promise.all([
      db.collection("pdis").find({ deletedAt: null }).toArray(),
      db.collection("pdi_tracking").find({ deletedAt: null }).toArray(),
      db.collection("pdi_evolutions").find({ deletedAt: null }, { projection: { studentId: 1, data: 1 } }).toArray(),
    ])

    const lastEvolutionByStudent = new Map<string, string>()
    // "Última atualização" mostrada no card (data + do que se trata): considera tanto registros de
    // evolução por área quanto marcos gerais (eventos), pegando o mais recente entre os dois.
    const lastUpdateByStudent = new Map<string, { data: string; label: string }>()
    for (const ev of evolutionsList as any[]) {
      const current = lastEvolutionByStudent.get(ev.studentId)
      if (!current || ev.data > current) lastEvolutionByStudent.set(ev.studentId, ev.data)

      const currentUpdate = lastUpdateByStudent.get(ev.studentId)
      if (!currentUpdate || ev.data > currentUpdate.data) {
        lastUpdateByStudent.set(ev.studentId, { data: ev.data, label: getPdiArea(ev.area).label })
      }
    }
    for (const pdi of pdisList as any[]) {
      for (const evento of pdi.eventos || []) {
        const currentUpdate = lastUpdateByStudent.get(pdi.studentId)
        if (!currentUpdate || evento.data > currentUpdate.data) {
          lastUpdateByStudent.set(pdi.studentId, { data: evento.data, label: evento.titulo })
        }
      }
    }

    const trackingByStudent = new Map<string, any[]>()
    for (const t of trackingList as any[]) {
      const list = trackingByStudent.get(t.studentId) || []
      list.push(t)
      trackingByStudent.set(t.studentId, list)
    }

    const items = (pdisList as any[]).map((pdi) => {
      const tracking = trackingByStudent.get(pdi.studentId) || []
      return {
        id: pdi.id,
        studentId: pdi.studentId,
        createdAt: pdi.createdAt,
        updatedAt: pdi.updatedAt,
        tracking: tracking.map((t) => ({ area: t.area, status: t.status, updatedAt: t.updatedAt, prazo: t.prazo || null })),
        lastEvolutionAt: lastEvolutionByStudent.get(pdi.studentId) || null,
        lastUpdateAt: lastUpdateByStudent.get(pdi.studentId)?.data || null,
        lastUpdateLabel: lastUpdateByStudent.get(pdi.studentId)?.label || null,
      }
    })

    const visibleItems = allowedStudentIds ? items.filter((i) => allowedStudentIds!.has(i.studentId)) : items
    return NextResponse.json({ pdis: visibleItems })
  } catch (err: any) {
    console.error("Erro em GET /pdis:", err)
    return NextResponse.json({ error: "Não foi possível carregar a Central de PDIs." }, { status: 500 })
  }
}
