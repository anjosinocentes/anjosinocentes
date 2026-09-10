import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { purgeExpiredTrash, PDI_TRASH_TTL_DAYS } from "@/lib/server/pdi-server-utils"

// Lixeira de PDIs: lista os PDIs excluídos que ainda estão dentro da janela de recuperação
// (7 dias). Quem tem a permissão PDIS pode ver e restaurar. Registros vencidos são apagados
// definitivamente (purgeExpiredTrash) antes de montar a lista.
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.PDIS)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    await purgeExpiredTrash(db)

    const [trashed, students] = await Promise.all([
      db.collection("pdis").find({ deletedAt: { $ne: null } }).sort({ deletedAt: -1 }).toArray(),
      db.collection("students").find({}, { projection: { id: 1, nome: 1 } }).toArray(),
    ])

    const nameById = new Map<string, string>((students as any[]).map((s) => [s.id, s.nome]))

    const items = (trashed as any[]).map((pdi) => {
      const deletedMs = new Date(pdi.deletedAt).getTime()
      const expiresAt = new Date(deletedMs + PDI_TRASH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
      return {
        id: pdi.id,
        studentId: pdi.studentId,
        studentName: nameById.get(pdi.studentId) || "Criança removida",
        deletedAt: pdi.deletedAt,
        deletedByName: pdi.deletedByName || null,
        expiresAt,
      }
    })

    return NextResponse.json({ trash: items, ttlDays: PDI_TRASH_TTL_DAYS })
  } catch (err: any) {
    console.error("Erro em GET /pdis/trash:", err)
    return NextResponse.json({ error: "Não foi possível carregar a lixeira de PDIs." }, { status: 500 })
  }
}
