import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc, getActorFromRequest } from "@/lib/server/server-db"
import { requirePermission, requireAuth } from "@/lib/server/server-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { validateAttachmentsServerSide } from "@/lib/attachment-validation"
import { announcementSchema, firstZodError } from "@/lib/schemas"

// Alguns registros antigos foram gravados com esquemas diferentes
// (content em vez de body, author_id/author_name em vez de authorId/authorName)
function field(doc: any, ...keys: string[]) {
  for (const key of keys) {
    if (doc[key] !== undefined && doc[key] !== null && doc[key] !== "") return doc[key]
  }
  return undefined
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    const docs = await db
      .collection("announcements")
      .find({})
      .sort({ created_at: -1, createdAt: -1 })
      .toArray()

    // Registros antigos só têm o id do autor salvo (sem nome/cargo) - resolve consultando users
    const missingIds = Array.from(
      new Set(
        docs
          .filter((d: any) => field(d, "authorId", "author_id") && !field(d, "authorName", "author_name"))
          .map((d: any) => field(d, "authorId", "author_id"))
      )
    ) as string[]

    let usersById: Record<string, any> = {}
    if (missingIds.length > 0) {
      const users = await db.collection("users").find({
        id: { $in: missingIds },
      }).toArray()
      users.forEach((u: any) => {
        usersById[u.id] = u
      })
    }

    const announcements = docs.map((doc: any) => {
      const normalized = normalizeDoc(doc)
      const authorId = field(doc, "authorId", "author_id")
      const authorName = field(doc, "authorName", "author_name")
      const authorRole = field(doc, "authorRole", "author_role")
      const author = authorName
        ? { id: authorId, name: authorName, role: authorRole }
        : authorId && usersById[authorId]
          ? { id: authorId, name: usersById[authorId].name, role: usersById[authorId].role }
          : null
      return {
        ...normalized,
        body: field(doc, "body", "content") || "",
        author,
      }
    })

    return NextResponse.json({ announcements })
  } catch (err: any) {
    console.error("Erro em GET /announcements:", err)
    return NextResponse.json({ error: "Não foi possível carregar os avisos." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.COMUNICACAO)
  if (auth instanceof NextResponse) return auth
  try {
    const actor = await getActorFromRequest(req)
    const raw = await req.json()

    const parsed = announcementSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const body = parsed.data // passthrough() preserva attachments e demais campos extras

    const attachmentCheck = validateAttachmentsServerSide(body.attachments)
    if (!attachmentCheck.ok) {
      return NextResponse.json({ error: attachmentCheck.error }, { status: 400 })
    }

    const newId = crypto.randomUUID()
    const newDoc = {
      id: newId,
      ...body,
      authorId: actor?.id || null,
      authorName: actor?.name || null,
      authorRole: actor?.role || null,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
    const db = await getDb()
    await db.collection("announcements").insertOne(newDoc)

    const announcement = {
      ...normalizeDoc(newDoc),
      author: actor ? { id: actor.id, name: actor.name, role: actor.role } : null,
    }
    return NextResponse.json({ announcement }, { status: 201 })
  } catch (err: any) {
    console.error("Erro em POST /announcements:", err)
    return NextResponse.json({ error: "Não foi possível publicar o aviso. Tente novamente." }, { status: 500 })
  }
}
