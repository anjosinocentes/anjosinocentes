import { NextResponse } from "next/server"
import { getUserByToken } from "./server-db"
import type { UserRole } from "../auth"
import { PERMISSIONS, type Permission } from "../permissions"

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

// "Gestor de turmas": vê/edita Presença e Aulas de TODAS as turmas. É o ADMIN ou quem tem a
// permissão de Turmas (Diretor/Coordenador/Secretário por padrão). Quem NÃO é gestor (o professor,
// que tem só Presença/Aulas) fica restrito às turmas que leciona (professorId = seu id). Baseado na
// PERMISSÃO, não no rótulo do cargo - assim a regra não é burlável trocando o cargo por outro nome.
export function isTurmaManager(user: AuthedUser): boolean {
  return user.role === "ADMIN" || !!user.permissions?.includes(PERMISSIONS.TURMAS)
}

// Regras de quem pode ATRIBUIR cada cargo. A gestão de equipe é exclusiva de ADMIN/DIRETOR
// (garantido por requireTeamAdmin na rota). ANTI-ESCALAÇÃO: apenas o ADMIN pode criar/atribuir o
// cargo ADMIN; um Diretor pode atribuir os demais cargos, mas nunca ADMIN.
export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === "ADMIN") return actorRole === "ADMIN"
  return actorRole === "ADMIN" || actorRole === "DIRECTOR"
}

// "Não conceder o que não se tem": um ator só pode atribuir a outra pessoa permissões que ele
// próprio possui. O ADMIN (super-usuário) pode conceder qualquer permissão. Retorna as permissões
// que o ator NÃO poderia conceder (vazio = pode conceder todas as pedidas).
export function permissionsActorCannotGrant(actor: AuthedUser, requested: string[]): string[] {
  if (actor.role === "ADMIN") return []
  const owned = new Set(actor.permissions || [])
  return (requested || []).filter((p) => !owned.has(p))
}

// Gestão de equipe (criar/editar/excluir colaborador, cargos, permissões, logs de auditoria) é
// EXCLUSIVA de ADMIN/DIRETOR - nunca liberada por uma permissão de módulo genérica.
export async function requireTeamAdmin(req: Request): Promise<AuthedUser | NextResponse> {
  return requireRole(req, "DIRECTOR") // hasRole já inclui ADMIN automaticamente
}

// Versão exportável da checagem de permissão do servidor (para uso fora dos require*).
export function can(user: AuthedUser, permission: Permission): boolean {
  return hasPermissionServer(user, permission)
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
  // Espelha lib/permissions.ts (hasPermission): só o super-usuário ADMIN tem bypass; todos os
  // demais cargos são rótulos e dependem exclusivamente das caixinhas (`permissions`).
  return user.role === "ADMIN" || !!user.permissions?.includes(permission)
}

// Combina requireAuth + checagem de permissão (em vez de papel). Use para recursos liberados
// por checkbox em Equipe (ex.: PDIs, Alunos) em vez de restritos a um conjunto fixo de papéis.
export async function requirePermission(req: Request, permission: Permission): Promise<AuthedUser | NextResponse> {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermissionServer(auth, permission)) return forbidden()
  return auth
}

// -----------------------------------------------------------------------------
// PONTO CENTRAL DE AUTORIZAÇÃO (deny-by-default)
// -----------------------------------------------------------------------------
// Toda rota protegida deve chamar `authorize(req, regra)` no início do handler. A regra declara
// explicitamente o que é exigido (permissão, cargo e/ou um escopo por dono/turma). Se a regra não
// exigir NADA (objeto vazio), o acesso é NEGADO - é impossível "esquecer" de proteger e deixar
// aberto: sem regra explícita, ninguém entra. A autorização acontece sempre no servidor; o
// frontend apenas reflete as permissões.
export type AuthzRule = {
  // Permissão de módulo exigida (caixinha). ADMIN sempre passa.
  permission?: Permission
  // Cargos permitidos (ADMIN sempre incluído). Use para áreas administrativas (equipe/auditoria).
  roles?: UserRole[]
  // Checagem de ESCOPO por registro/dono/turma (ex.: professor só na própria turma). Recebe o
  // usuário autenticado e deve devolver uma NextResponse de erro (nega) ou null (libera).
  scope?: (user: AuthedUser, req: Request) => Promise<NextResponse | null> | NextResponse | null
}

export async function authorize(req: Request, rule: AuthzRule): Promise<AuthedUser | NextResponse> {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const declaresSomething = !!rule && (rule.permission !== undefined || (rule.roles && rule.roles.length > 0) || typeof rule.scope === "function")
  if (!declaresSomething) {
    // Deny-by-default: rota sem regra explícita nunca libera.
    console.error("authorize(): rota protegida sem regra de autorização explícita - acesso negado.")
    return forbidden("Acesso negado.")
  }

  if (rule.roles && rule.roles.length > 0 && !hasRole(auth, ...rule.roles)) return forbidden()
  if (rule.permission !== undefined && !hasPermissionServer(auth, rule.permission)) return forbidden()
  if (typeof rule.scope === "function") {
    const denied = await rule.scope(auth, req)
    if (denied) return denied
  }
  return auth
}
