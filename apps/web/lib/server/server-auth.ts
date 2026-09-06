import { NextResponse } from "next/server"
import { getUserByToken } from "./server-db"
import type { UserRole } from "../auth"
import type { Permission } from "../permissions"

export type AuthedUser = {
  id: string
  name: string
  email: string
  role: UserRole
  permissions?: string[]
  active?: boolean
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function unauthorized(message = "Não autenticado") {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbidden(message = "Sem permissão para executar esta ação") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export const SESSION_COOKIE = "anjos_token"
export const REFRESH_COOKIE = "anjos_refresh"
// O cookie de refresh só é enviado para o endpoint de renovação, reduzindo sua exposição.
export const REFRESH_COOKIE_PATH = "/api/auth/refresh"

// Lê o token do cookie de sessão (httpOnly). Mantém como fonte primária, já que o token
// não fica mais acessível ao JavaScript do cliente.
function tokenFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie")
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="))
  }
  return null
}

// Extrai e valida o token de sessão, retornando o usuário autenticado.
// Fonte primária: cookie httpOnly `anjos_token`. Fallback: header Authorization: Bearer
// (compatibilidade com clientes antigos / chamadas server-to-server).
// Lança AuthError (401) se não houver token válido - use dentro de um try/catch
// no handler da rota, ou prefira `requireAuth`/`requireRole` abaixo.
export async function getAuthedUser(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get("authorization")
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null
  const token = tokenFromCookie(req) || bearer
  if (!token) throw new AuthError("Não autenticado", 401)
  try {
    const user = await getUserByToken(token)
    return user as AuthedUser
  } catch {
    throw new AuthError("Sessão inválida ou expirada", 401)
  }
}

// Uso: const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth
// `auth` vira o usuário autenticado quando a checagem passa.
export async function requireAuth(req: Request): Promise<AuthedUser | NextResponse> {
  try {
    return await getAuthedUser(req)
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return unauthorized()
  }
}

// ADMIN sempre tem acesso, igual ao middleware equivalente da API Express (requireRole).
export function hasRole(user: AuthedUser, ...roles: UserRole[]) {
  return user.role === "ADMIN" || roles.includes(user.role)
}

// Regras de quem pode ATRIBUIR cada cargo (criar/promover). Nunca confiar no cargo vindo do
// cliente: a decisão é sempre validada no servidor a partir do papel do usuário autenticado.
//  - ADMIN: só ADMIN pode criar/atribuir.
//  - DIRECTOR: só ADMIN ou DIRECTOR.
//  - COORDINATOR/SECRETARY/TEACHER/STUDENT: ADMIN, DIRECTOR ou COORDINATOR.
// (TEACHER e SECRETARY nem alcançam os endpoints de gestão de usuários - barrados antes por requireRole.)
export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === "ADMIN") return actorRole === "ADMIN"
  if (targetRole === "DIRECTOR") return actorRole === "ADMIN" || actorRole === "DIRECTOR"
  return actorRole === "ADMIN" || actorRole === "DIRECTOR" || actorRole === "COORDINATOR"
}

// Combina requireAuth + checagem de papel. Retorna o usuário ou uma NextResponse de erro pronta pra devolver.
export async function requireRole(req: Request, ...roles: UserRole[]): Promise<AuthedUser | NextResponse> {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasRole(auth, ...roles)) return forbidden()
  return auth
}

// Mesma regra de lib/permissions.ts (hasPermission), reimplementada aqui em vez de importada:
// AuthedUser e o AuthUser do cliente têm o campo `permissions` com opcionalidade diferente
// (aqui é opcional), então reusar a função do cliente exigiria um cast. ADMIN/DIRECTOR sempre
// passam, igual ao restante do sistema.
function hasPermissionServer(user: AuthedUser, permission: Permission) {
  return user.role === "ADMIN" || user.role === "DIRECTOR" || !!user.permissions?.includes(permission)
}

// Combina requireAuth + checagem de permissão (em vez de papel). Use para recursos liberados
// por checkbox em Equipe (ex.: PDIs, Alunos) em vez de restritos a um conjunto fixo de papéis.
export async function requirePermission(req: Request, permission: Permission): Promise<AuthedUser | NextResponse> {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermissionServer(auth, permission)) return forbidden()
  return auth
}
