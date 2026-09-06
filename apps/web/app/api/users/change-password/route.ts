import { NextRequest, NextResponse } from "next/server"
import { getDb, getActorFromRequest } from "@/lib/server/server-db"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const actor = await getActorFromRequest(req)
    if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const { currentPassword, newPassword } = await req.json()
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "A nova senha deve ter pelo menos 6 caracteres" }, { status: 400 })
    }

    const db = await getDb()
    const filter = {
      id: actor.id,
    }
    const user = await db.collection("users").findOne(filter)
    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })

    const storedHash = user.password || user.passwordHash || ""
    const valid = storedHash ? await bcrypt.compare(currentPassword || "", storedHash) : false
    if (!valid) {
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 401 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await db.collection("users").updateOne(filter, { $set: { passwordHash }, $unset: { password: "" } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
