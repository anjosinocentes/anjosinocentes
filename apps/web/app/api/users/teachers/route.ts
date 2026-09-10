import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc, sanitizeUser, logAudit } from "@/lib/server/server-db"
import bcrypt from "bcryptjs"
import { requirePermission, canAssignRole } from "@/lib/server/server-auth"
import { teacherSchema, firstZodError } from "@/lib/schemas"
import { PERMISSIONS, defaultPermissionsForRole } from "@/lib/permissions"
import { getPasswordValidationError } from "@/lib/password-policy"
import type { UserRole } from "@/lib/auth"

// Garante que cada colaborador tenha permissões coerentes com o cargo (contas antigas/criadas
// sem o campo `permissions` cairiam como undefined e quebrariam a tela de Equipe).
function withRolePermissions(u: any) {
  if (u && (!Array.isArray(u.permissions) || u.permissions.length === 0)) {
    u.permissions = defaultPermissionsForRole(u.role)
  }
  return u
}

// Conta de administrador de sistema criada pelo seed (db/supabase-schema.sql). É o super-usuário
// e não deve aparecer na tela de Equipe (não é um "colaborador" a ser gerenciado ali).
const SYSTEM_ADMIN_ID = "admin-default-id"

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.EQUIPE)
  if (auth instanceof NextResponse) return auth
  try {
    const db = await getDb()
    const docs = await db
      .collection("users")
      .find({ role: { $ne: "STUDENT" }, id: { $ne: SYSTEM_ADMIN_ID } })
      .toArray()
    const teachers = docs.map(normalizeDoc).map(sanitizeUser).map(withRolePermissions)
    return NextResponse.json({ teachers })
  } catch (err: any) {
    console.error("Erro em GET /users/teachers:", err)
    return NextResponse.json({ error: "Não foi possível carregar os colaboradores." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, PERMISSIONS.EQUIPE)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = await req.json()
    const parsed = teacherSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const body = parsed.data
    if (!body.password) {
      return NextResponse.json({ error: "A senha inicial é obrigatória" }, { status: 400 })
    }
    const pwError = getPasswordValidationError(body.password)
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 })
    }
    // Anti-escalação de privilégio: o cargo é validado no servidor pelo papel do usuário autenticado,
    // NUNCA confiando no valor enviado pelo frontend. Cargo ausente cai no menos privilegiado (TEACHER).
    const targetRole = ((body.role as UserRole) || "TEACHER")
    if (!canAssignRole(auth.role, targetRole)) {
      return NextResponse.json(
        { error: `Você não tem permissão para atribuir o cargo ${targetRole}.` },
        { status: 403 }
      )
    }

    const db = await getDb()
    const normalizedEmail = body.email.trim().toLowerCase()
    const existing = await db.collection("users").findOne({ email: { $regex: `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } })
    if (existing) {
      return NextResponse.json({ error: "Já existe um colaborador cadastrado com esse e-mail." }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(body.password, 10)
    const newId = crypto.randomUUID()
    const { password, ...rest } = body
    const newDoc = { id: newId, ...rest, passwordHash, active: true, created_at: new Date().toISOString() }
    await db.collection("users").insertOne(newDoc)
    await logAudit(req, "CREATE", "user", `Criou o colaborador ${newDoc.name} (cargo: ${newDoc.role})`, newId)
    return NextResponse.json({ user: sanitizeUser(normalizeDoc(newDoc)) }, { status: 201 })
  } catch (err: any) {
    console.error("Erro em POST /users/teachers:", err)
    return NextResponse.json({ error: "Não foi possível cadastrar o colaborador. Tente novamente." }, { status: 500 })
  }
}
