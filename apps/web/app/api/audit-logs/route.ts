import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/server/server-db"
import { requirePermission } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"

// Alguns registros antigos foram gravados com um esquema diferente
// (user_id/details/resource_id/timestamp em vez de userName/description/targetId/createdAt).
function normalizeAuditLog(doc: any) {
  return {
    id: doc.id || doc._id?.toString(),
    userId: doc.userId || doc.user_id || null,
    userName: doc.userName || doc.user_name || "Sistema",
    userRole: doc.userRole || doc.user_role || "",
    action: doc.action || "UPDATE",
    resource: doc.resource || "",
    description: doc.description || doc.details || "",
    targetId: doc.targetId || doc.target_id || doc.resource_id || null,
    createdAt: doc.createdAt || doc.created_at || doc.timestamp || new Date().toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.EQUIPE)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    const docs = await db
      .collection("audit_logs")
      .find({})
      .sort({ created_at: -1, createdAt: -1, timestamp: -1 })
      .limit(500)
      .toArray()
    return NextResponse.json({ logs: docs.map(normalizeAuditLog) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
