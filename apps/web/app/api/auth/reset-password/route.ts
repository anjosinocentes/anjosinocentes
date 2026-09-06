import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { getDb } from "@/lib/server/server-db"
import { consumePasswordResetToken } from "@/lib/server/password-reset"
import { getPasswordValidationError } from "@/lib/password-policy"

const schema = z.object({
  token: z.string().trim().min(1, "Token ausente"),
  password: z.string().min(1, "A senha é obrigatória"),
  confirmPassword: z.string().min(1, "A confirmação de senha é obrigatória"),
})

export async function POST(req: NextRequest) {
  let data: z.infer<typeof schema>
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || "Dados inválidos" }, { status: 400 })
    }
    data = parsed.data
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  if (data.password !== data.confirmPassword) {
    return NextResponse.json({ error: "As senhas não coincidem" }, { status: 400 })
  }

  const passwordError = getPasswordValidationError(data.password)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  try {
    // Checagem final e definitiva do token no momento da troca - nunca confia na validação
    // que o frontend já fez antes (o link pode ter expirado ou sido usado nesse meio-tempo).
    const userId = await consumePasswordResetToken(data.token)
    if (!userId) {
      return NextResponse.json(
        { error: "Este link de recuperação é inválido, expirou ou já foi utilizado." },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(data.password, 10)
    const db = await getDb()
    const filter = {
      id: userId,
    }
    await db.collection("users").updateOne(filter, { $set: { passwordHash }, $unset: { password: "" } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Erro em /auth/reset-password:", err)
    return NextResponse.json({ error: "Não foi possível redefinir a senha. Tente novamente." }, { status: 500 })
  }
}
