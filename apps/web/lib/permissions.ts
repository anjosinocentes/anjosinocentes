import type { AuthUser } from "@/lib/auth"

export const PERMISSIONS = {
  ALUNOS: "alunos",
  TURMAS: "turmas",
  PRESENCA: "presenca",
  PLANO_AULA: "plano_aula",
  CALENDARIO: "calendario",
  COMUNICACAO: "comunicacao",
  PDIS: "pdis",
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// Permissões padrão por cargo. Fonte única usada tanto no formulário de Equipe quanto no
// servidor (fallback para usuários sem `permissions` gravado). Professor NÃO inclui `alunos`
// nem `turmas` - por isso não deve ver atalhos de cadastro de crianças sem liberação explícita.
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  TEACHER: [PERMISSIONS.PRESENCA, PERMISSIONS.PLANO_AULA, PERMISSIONS.CALENDARIO, PERMISSIONS.COMUNICACAO],
  COORDINATOR: [PERMISSIONS.ALUNOS, PERMISSIONS.TURMAS, PERMISSIONS.PRESENCA, PERMISSIONS.PLANO_AULA, PERMISSIONS.CALENDARIO, PERMISSIONS.COMUNICACAO],
  SECRETARY: [PERMISSIONS.ALUNOS, PERMISSIONS.TURMAS, PERMISSIONS.PRESENCA, PERMISSIONS.CALENDARIO, PERMISSIONS.COMUNICACAO],
  ADMIN: [PERMISSIONS.ALUNOS, PERMISSIONS.TURMAS, PERMISSIONS.PRESENCA, PERMISSIONS.PLANO_AULA, PERMISSIONS.CALENDARIO, PERMISSIONS.COMUNICACAO, PERMISSIONS.PDIS],
  DIRECTOR: [PERMISSIONS.ALUNOS, PERMISSIONS.TURMAS, PERMISSIONS.PRESENCA, PERMISSIONS.PLANO_AULA, PERMISSIONS.CALENDARIO, PERMISSIONS.COMUNICACAO, PERMISSIONS.PDIS],
  STUDENT: [],
}

export function defaultPermissionsForRole(role?: string): Permission[] {
  return DEFAULT_ROLE_PERMISSIONS[role || ""] ?? []
}

export function hasPermission(user: AuthUser | null, permission: Permission) {
  if (!user) return false
  if (user.role === "ADMIN" || user.role === "DIRECTOR") return true
  return user.permissions?.includes(permission)
}
