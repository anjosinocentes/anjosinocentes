import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// -----------------------------------------------------------------------------
// CHOKE POINT DE AUTENTICAÇÃO (deny-by-default) para /api/*
// -----------------------------------------------------------------------------
// Toda rota /api exige uma sessão presente (cookie httpOnly ou Bearer), EXCETO as públicas
// listadas abaixo. Isso garante que qualquer rota NOVA já nasça protegida por padrão, mesmo que
// alguém esqueça o guard no handler. A verificação criptográfica do token e a AUTORIZAÇÃO por
// permissão/cargo continuam em cada handler (que tem acesso ao banco) - isto aqui é a primeira
// barreira e defesa em profundidade, não a única.
const PUBLIC_API_PATHS = new Set<string>([
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/reset-password/validate",
])

const SESSION_COOKIE = "anjos_token"

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith("/api/")) return NextResponse.next()
  if (PUBLIC_API_PATHS.has(pathname)) return NextResponse.next()

  const hasBearer = req.headers.get("authorization")?.startsWith("Bearer ") ?? false
  const hasSessionCookie = !!req.cookies.get(SESSION_COOKIE)?.value
  if (!hasBearer && !hasSessionCookie) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
