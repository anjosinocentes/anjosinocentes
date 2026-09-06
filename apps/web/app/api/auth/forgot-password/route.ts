import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/server/server-db"
import { normalizeEmail, checkRateLimit, createPasswordResetToken } from "@/lib/server/password-reset"
import { sendPasswordResetEmail } from "@/lib/server/mailer"

const schema = z.object({
  email: z.string().trim().min(1, "O e-mail é obrigatório").email("Informe um e-mail válido"),
})

// Mensagem genérica sempre - nunca revela se o e-mail existe no sistema (evita enumeração de usuários).
const GENERIC_MESSAGE = "Se o e-mail informado estiver cadastrado, você receberá um link para redefinir sua senha."

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}

export async function POST(req: NextRequest) {
  let email: string
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || "E-mail inválido" }, { status: 400 })
    }
    email = normalizeEmail(parsed.data.email)
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  const ip = getClientIp(req)

  try {
    const withinLimit = await checkRateLimit(email, ip)
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Muitas solicitações. Aguarde alguns minutos antes de tentar novamente." },
        { status: 429 }
      )
    }

    const db = await getDb()
    const user = await db.collection("users").findOne({ email })

    if (user && user.active !== false) {
      const token = await createPasswordResetToken(user.id || user._id.toString(), email, ip)
      const frontendUrl = (process.env.FRONTEND_URL || req.nextUrl.origin).replace(/\/$/, "")
      const resetUrl = `${frontendUrl}/redefinir-senha?token=${token}`

      try {
        await sendPasswordResetEmail(user.email, user.name || "", resetUrl)
      } catch (err) {
        // Falha no envio não deve vazar para o cliente (manteria a mensagem genérica) nem
        // travar a resposta - só registra para diagnóstico.
        console.error("Erro ao enviar e-mail de recuperação de senha:", err)
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE })
  } catch (err) {
    console.error("Erro em /auth/forgot-password:", err)
    // Mesmo em erro interno, não revela detalhes - mantém a mensagem genérica.
    return NextResponse.json({ message: GENERIC_MESSAGE })
  }
}
