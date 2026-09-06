import { NextRequest, NextResponse } from "next/server"
import {
  verifyRefreshToken,
  getPublicUserById,
  signAccessToken,
  signRefreshToken,
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
} from "@/lib/server/server-db"
import { SESSION_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH } from "@/lib/server/server-auth"

// Renova a sessão: valida o refresh token (cookie httpOnly de path restrito), reemite um access
// token novo e ROTACIONA o refresh (sessão deslizante - usuário ativo continua logado; inativo
// expira em 7 dias). Reconfirma que a conta ainda existe e está ativa.
export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || ""
  let refreshToken: string | null = null
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === REFRESH_COOKIE) refreshToken = decodeURIComponent(rest.join("="))
  }
  if (!refreshToken) {
    return NextResponse.json({ error: "Sessão expirada" }, { status: 401 })
  }

  try {
    const userId = verifyRefreshToken(refreshToken)
    const user = await getPublicUserById(userId)
    if (user.active === false) {
      return NextResponse.json({ error: "Conta desativada" }, { status: 401 })
    }

    const secure = process.env.NODE_ENV === "production"
    const res = NextResponse.json({ user })
    res.cookies.set(SESSION_COOKIE, signAccessToken(user), {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TTL_SECONDS,
    })
    res.cookies.set(REFRESH_COOKIE, signRefreshToken(user), {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_TTL_SECONDS,
    })
    return res
  } catch {
    return NextResponse.json({ error: "Sessão expirada" }, { status: 401 })
  }
}
