import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc, sanitizeUser, getActorFromRequest } from "@/lib/server/server-db"

export async function PUT(req: NextRequest) {
  try {
    const actor = await getActorFromRequest(req)
    if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const body = await req.json()
    const { name, email, avatarUrl } = body

    const update: Record<string, any> = {}
    if (typeof name === "string") update.name = name
    if (typeof email === "string") update.email = email
    if (typeof avatarUrl === "string") update.avatarUrl = avatarUrl

    const db = await getDb()
    const filter = {
      id: actor.id,
    }
    await db.collection("users").updateOne(filter, { $set: update })
    const updated = await db.collection("users").findOne(filter)
    return NextResponse.json({ user: sanitizeUser(normalizeDoc(updated)) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
