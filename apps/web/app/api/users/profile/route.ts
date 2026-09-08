import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc, sanitizeUser, getActorFromRequest } from "@/lib/server/server-db"

export async function PUT(req: NextRequest) {
  try {
    const actor = await getActorFromRequest(req)
    if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const body = await req.json()
    const { name, email, avatarUrl } = body

    const db = await getDb()
    const filter = { id: actor.id }

    const update: Record<string, any> = {}
    if (typeof name === "string") update.name = name
    if (typeof avatarUrl === "string") update.avatarUrl = avatarUrl

    if (typeof email === "string") {
      // Normaliza (trim + lowercase) para evitar duplicatas por diferença de caixa/espaços,
      // já que o login busca o usuário pelo e-mail.
      const normalizedEmail = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 })
      }
      // Unicidade: nenhum OUTRO usuário pode ter esse e-mail. Sem essa checagem, dois usuários
      // ficariam com o mesmo e-mail, gerando ambiguidade no login (risco de lockout do admin).
      const existing = await db.collection("users").findOne({ email: normalizedEmail })
      if (existing && existing.id !== actor.id) {
        return NextResponse.json({ error: "Este e-mail já está em uso por outra conta." }, { status: 409 })
      }
      update.email = normalizedEmail
    }

    await db.collection("users").updateOne(filter, { $set: update })
    const updated = await db.collection("users").findOne(filter)
    return NextResponse.json({ user: sanitizeUser(normalizeDoc(updated)) })
  } catch (err: any) {
    // Não vaza detalhes internos (ex.: violação de índice único) para o cliente.
    console.error("Erro em PUT /users/profile:", err)
    return NextResponse.json({ error: "Não foi possível atualizar o perfil. Tente novamente." }, { status: 500 })
  }
}
