import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { createPgDb } from "./pg-collection"
import { defaultPermissionsForRole } from "@/lib/permissions"

// Garante que o usuário sempre tenha permissões coerentes com o cargo. Se `permissions` não foi
// gravado (contas legadas/criadas sem o campo), NÃO aplica um fallback largo - usa o padrão do
// cargo (ex.: professor não recebe `alunos`/`turmas`). Consistente entre login, /me e refresh.
function withRolePermissions<T extends { role?: string; permissions?: any }>(u: T): T {
  if (u && (!Array.isArray(u.permissions) || u.permissions.length === 0)) {
    ;(u as any).permissions = defaultPermissionsForRole(u.role)
  }
  return u
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET não configurado. Defina uma variável de ambiente JWT_SECRET (mínimo 16 caracteres).")
}
const JWT_SECRET = process.env.JWT_SECRET

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL não configurado. Defina a variável de ambiente com a connection string do Postgres (Supabase).")
}

// Mantém a mesma interface de sempre (db.collection(...).find/insertOne/...), mas agora
// implementada sobre Postgres/Supabase - ver lib/pg-collection.ts.
export async function getDb() {
  return createPgDb(DATABASE_URL as string)
}

export function normalizeDoc(doc: any): any {
  if (!doc) return null
  const id = doc.id || (doc._id ? doc._id.toString() : crypto.randomUUID())
  return {
    ...doc,
    id,
    data_nascimento: doc.data_nascimento || doc.dataNascimento || "",
    dataNascimento: doc.dataNascimento || doc.data_nascimento || "",
    class_id: doc.class_id || doc.classId || null,
    classId: doc.classId || doc.class_id || null,
    class_ids: doc.class_ids || doc.classIds || [],
    classIds: doc.classIds || doc.class_ids || [],
    course_id: doc.course_id || doc.courseId || null,
    courseId: doc.courseId || doc.course_id || null,
    professor_id: doc.professor_id || doc.professorId || null,
    professorId: doc.professorId || doc.professor_id || null,
    student_id: doc.student_id || doc.studentId || doc.alunoId || null,
    studentId: doc.studentId || doc.student_id || doc.alunoId || null,
    dias_semana: doc.dias_semana || doc.diasSemana || [],
    diasSemana: doc.diasSemana || doc.dias_semana || [],
    alunos_matriculados: doc.alunos_matriculados ?? doc.alunosMatriculados ?? 0,
    alunosMatriculados: doc.alunosMatriculados ?? doc.alunos_matriculados ?? 0,
    student_ids: doc.student_ids || doc.studentIds || [],
    studentIds: doc.studentIds || doc.student_ids || [],
    created_at: doc.created_at || (doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString()),
    createdAt: doc.createdAt || doc.created_at || new Date().toISOString(),
  }
}

// Remove campos sensíveis antes de devolver um usuário/colaborador ao cliente
export function sanitizeUser(doc: any): any {
  if (!doc) return doc
  const { password, passwordHash, ...safe } = doc
  return safe
}

// Identifica quem está fazendo a requisição, para logs de auditoria e rotas que agem sobre o
// próprio usuário (change-password, profile). Fonte primária: cookie httpOnly `anjos_token`;
// fallback: header Authorization: Bearer (compatibilidade).
export async function getActorFromRequest(req: Request) {
  try {
    let token: string | null = null
    const cookieHeader = req.headers.get("cookie")
    if (cookieHeader) {
      for (const part of cookieHeader.split(";")) {
        const [name, ...rest] = part.trim().split("=")
        if (name === "anjos_token") { token = decodeURIComponent(rest.join("=")); break }
      }
    }
    if (!token) {
      const authHeader = req.headers.get("authorization")
      token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null
    }
    if (!token) return null
    return await getUserByToken(token)
  } catch {
    return null
  }
}

export async function logAudit(
  req: Request,
  action: "CREATE" | "UPDATE" | "DELETE" | "RESET_PASSWORD",
  resource: string,
  description: string,
  targetId?: string | null
) {
  try {
    const actor = await getActorFromRequest(req)
    if (!actor) return
    const db = await getDb()
    await db.collection("audit_logs").insertOne({
      id: crypto.randomUUID(),
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action,
      resource,
      description,
      targetId: targetId || null,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error("Erro ao registrar log de auditoria:", err)
  }
}

export async function loginUser(email: string, password: string) {
  const db = await getDb()
  const user = await db.collection("users").findOne({ email })

  if (!user) {
    throw new Error("Credenciais inválidas")
  }

  if (user.active === false) {
    throw new Error("Sua conta está desativada. Entre em contato com a administração.")
  }

  const valid = await bcrypt.compare(password, user.password || user.passwordHash || "")
  if (!valid) {
    throw new Error("Credenciais inválidas")
  }

  const normalizedUser = normalizeDoc(user)
  const publicUser = {
    id: normalizedUser.id,
    name: normalizedUser.name,
    email: normalizedUser.email,
    role: normalizedUser.role || "ADMIN",
    permissions:
      (Array.isArray(normalizedUser.permissions) && normalizedUser.permissions.length)
        ? normalizedUser.permissions
        : defaultPermissionsForRole(normalizedUser.role || "ADMIN"),
    active: true,
    avatarUrl: normalizedUser.avatarUrl || null,
  }

  return {
    accessToken: signAccessToken(publicUser),
    refreshToken: signRefreshToken(publicUser),
    user: publicUser,
  }
}

// Sessão em dois tokens: um ACCESS curto (15 min) para autenticar as chamadas e um REFRESH de
// 2 HORAS usado só para renovar o access. Como o refresh é REEMITIDO (rotacionado) a cada
// renovação, ele funciona como uma "janela deslizante de inatividade": enquanto o usuário usa o
// sistema, o refresh é renovado; se ficar ~2h sem nenhuma requisição, o refresh expira e o próximo
// acesso cai para a tela de login. Access curto também limita a exposição de um token vazado.
// Ambos são JWT assinados com o mesmo JWT_SECRET; o refresh fica em cookie de path /api/auth/refresh.
export const ACCESS_TTL_SECONDS = 60 * 15
export const REFRESH_TTL_SECONDS = 60 * 60 * 2

export function signAccessToken(u: { id: string; email: string; role: string }): string {
  return jwt.sign({ sub: u.id, email: u.email, role: u.role, type: "access" }, JWT_SECRET, { expiresIn: ACCESS_TTL_SECONDS })
}

export function signRefreshToken(u: { id: string }): string {
  return jwt.sign({ sub: u.id, type: "refresh" }, JWT_SECRET, { expiresIn: REFRESH_TTL_SECONDS })
}

// Valida um refresh token e devolve o id do usuário. Rejeita access tokens usados como refresh.
export function verifyRefreshToken(token: string): string {
  const decoded = jwt.verify(token, JWT_SECRET) as any
  if (decoded.type !== "refresh") throw new Error("Token de refresh inválido")
  return decoded.sub
}

export async function getUserByToken(token: string) {
  const decoded = jwt.verify(token, JWT_SECRET) as any
  // Um refresh token nunca autentica uma chamada de dados - só serve para /api/auth/refresh.
  if (decoded.type === "refresh") throw new Error("Tipo de token inválido")
  const db = await getDb()
  const user = await db.collection("users").findOne({ id: decoded.sub })
  if (!user) throw new Error("User not found")
  return withRolePermissions(sanitizeUser(normalizeDoc(user)))
}

// Busca o usuário público por id (sem hash de senha) - usado ao renovar a sessão no refresh,
// para reemitir o access com o papel/e-mail atuais e confirmar que a conta ainda existe/está ativa.
export async function getPublicUserById(id: string) {
  const db = await getDb()
  const user = await db.collection("users").findOne({ id })
  if (!user) throw new Error("User not found")
  return withRolePermissions(sanitizeUser(normalizeDoc(user)))
}
