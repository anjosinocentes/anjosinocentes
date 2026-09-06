import { NextRequest, NextResponse } from "next/server"
import { getDb, normalizeDoc, sanitizeUser, logAudit } from "@/lib/server/server-db"
import { requireRole, canAssignRole } from "@/lib/server/server-auth"
import { teacherUpdateSchema, firstZodError } from "@/lib/schemas"
import type { UserRole } from "@/lib/auth"

const ALLOWED_TEACHER_UPDATE_FIELDS = [
  "name", "email", "cpf", "telefone", "dataNascimento", "data_nascimento",
  "endereco", "role", "permissions", "active", "avatarUrl",
]

// Conta quantos ADMIN/DIRECTOR ativos existem, excluindo opcionalmente um id - usado para
// impedir remover/desativar/rebaixar o último administrador e travar o acesso ao sistema
// (já aconteceu nesta base: o bootstrap automático de admin foi removido por segurança).
async function countOtherActiveAdmins(db: any, excludeId: string) {
  return db.collection("users").countDocuments({
    id: { $ne: excludeId },
    role: { $in: ["ADMIN", "DIRECTOR"] },
    active: { $ne: false },
  })
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "DIRECTOR", "COORDINATOR")
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params
    const raw = await req.json()
    const parsed = teacherUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
    }
    const body = { ...raw, ...parsed.data }

    const db = await getDb()

    // Anti-escalação: se está tentando definir/alterar o cargo, valida no servidor se o papel do
    // usuário autenticado pode atribuir aquele cargo (nunca confia no valor do frontend).
    if (body.role !== undefined && !canAssignRole(auth.role, body.role as UserRole)) {
      return NextResponse.json(
        { error: `Você não tem permissão para atribuir o cargo ${body.role}.` },
        { status: 403 }
      )
    }

    // Trava adicional: Coordenador não pode sequer editar contas de Diretores/Admins.
    if (auth.role === "COORDINATOR") {
      const target = await db.collection("users").findOne({ id })
      if (target && (target.role === "DIRECTOR" || target.role === "ADMIN")) {
        return NextResponse.json({ error: "Coordenadores não podem editar Diretores ou Administradores." }, { status: 403 })
      }
    }

    if (body.email) {
      const normalizedEmail = body.email.trim().toLowerCase()
      const escaped = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const existing = await db.collection("users").findOne({ email: { $regex: `^${escaped}$`, $options: "i" } })
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Já existe outro colaborador cadastrado com esse e-mail." }, { status: 409 })
      }
    }

    // Nunca aceita `password`/`passwordHash` por aqui - troca de senha passa pelo endpoint
    // dedicado de reset, que sempre gera um hash bcrypt novo.
    const update: Record<string, any> = {}
    for (const key of ALLOWED_TEACHER_UPDATE_FIELDS) {
      if (body[key] !== undefined) update[key] = body[key]
    }

    const isDemotingOrDeactivating =
      (update.role !== undefined && !["ADMIN", "DIRECTOR"].includes(update.role)) ||
      update.active === false
    if (isDemotingOrDeactivating) {
      const remaining = await countOtherActiveAdmins(db, id)
      if (remaining === 0) {
        return NextResponse.json(
          { error: "Não é possível remover o acesso do único administrador/diretor ativo do sistema." },
          { status: 409 }
        )
      }
    }

    const filter = { id }
    await db.collection("users").updateOne(filter, { $set: update })
    const updated = await db.collection("users").findOne(filter)
    await logAudit(
      req,
      "UPDATE",
      "user",
      `Atualizou o colaborador ${updated?.name ?? id} (cargo: ${updated?.role}, ativo: ${updated?.active})`,
      id
    )
    return NextResponse.json({ user: sanitizeUser(normalizeDoc(updated)) })
  } catch (err: any) {
    console.error("Erro em PUT /users/teachers/:id:", err)
    return NextResponse.json({ error: "Não foi possível atualizar o colaborador. Tente novamente." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "DIRECTOR")
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await props.params

    if (id === auth.id) {
      return NextResponse.json({ error: "Você não pode excluir sua própria conta." }, { status: 409 })
    }

    const db = await getDb()
    const filter = { id }
    const existing = await db.collection("users").findOne(filter)
    if (!existing) {
      return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 })
    }

    if (["ADMIN", "DIRECTOR"].includes(existing.role) && existing.active !== false) {
      const remaining = await countOtherActiveAdmins(db, id)
      if (remaining === 0) {
        return NextResponse.json(
          { error: "Não é possível excluir o único administrador/diretor ativo do sistema." },
          { status: 409 }
        )
      }
    }

    await db.collection("users").deleteOne(filter)
    await logAudit(req, "DELETE", "user", `Excluiu o colaborador ${existing?.name ?? id}`, id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro em DELETE /users/teachers/:id:", err)
    return NextResponse.json({ error: "Não foi possível excluir o colaborador. Tente novamente." }, { status: 500 })
  }
}
