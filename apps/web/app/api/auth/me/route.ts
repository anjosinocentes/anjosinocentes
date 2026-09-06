import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/server/server-auth"

export async function GET(req: NextRequest) {
  // requireAuth lê o token do cookie httpOnly `anjos_token` (ou, como fallback, do header Bearer).
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Payload mínimo e explícito: nunca devolve o objeto completo do usuário (evita vazar
  // senha/hash, tokens, CPF/telefone/endereço ou outros campos internos). `permissions` e
  // `avatarUrl` são necessários para a UI (gating de permissões e avatar).
  return NextResponse.json({
    user: {
      id: auth.id,
      name: auth.name,
      email: auth.email,
      role: auth.role,
      permissions: auth.permissions ?? [],
      avatarUrl: (auth as any).avatarUrl ?? null,
    },
  })
}
