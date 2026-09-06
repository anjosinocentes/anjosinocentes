import { NextRequest, NextResponse } from "next/server"
import { loginUser, ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from "@/lib/server/server-db"
import { SESSION_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH } from "@/lib/server/server-auth"
import { isLoginBlocked, recordFailedLogin, clearLoginAttempts } from "@/lib/server/login-rate-limit"

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}

export async function POST(req: NextRequest) {
  let email = ""
  let password = ""
  try {
    const body = await req.json()
    email = body?.email || ""
    password = body?.password || ""
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  const ip = getClientIp(req)

  // Rate limit: barra brute-force de senha antes de sequer checar as credenciais.
  try {
    if (await isLoginBlocked(email, ip)) {
      return NextResponse.json(
        { error: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente." },
        { status: 429 }
      )
    }
  } catch (err) {
    // Falha do rate limiter não deve derrubar o login (fail-open apenas para a checagem de limite).
    console.error("Falha ao checar rate limit de login:", err)
  }

  let result
  try {
    result = await loginUser(email, password)
  } catch (err: any) {
    // Credenciais inválidas: registra a falha (conta para o rate limit) e responde 401 genérico.
    try {
      await recordFailedLogin(email, ip)
    } catch (e) {
      console.error("Falha ao registrar tentativa de login:", e)
    }
    return NextResponse.json({ error: err.message || "Credenciais inválidas" }, { status: 401 })
  }

  // Sucesso: zera as tentativas do e-mail.
  try {
    await clearLoginAttempts(email)
  } catch (e) {
    console.error("Falha ao limpar tentativas de login:", e)
  }

  // Tokens em cookies httpOnly (inacessíveis ao JS): mitiga roubo de sessão via XSS.
  // Secure só em produção (em http://localhost o Secure impediria o cookie de ser enviado).
  const secure = process.env.NODE_ENV === "production"
  const res = NextResponse.json({ user: result.user })
  res.cookies.set(SESSION_COOKIE, result.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TTL_SECONDS,
  })
  res.cookies.set(REFRESH_COOKIE, result.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_SECONDS,
  })
  return res
}
