import type { AuthUser } from "@/lib/auth"

// Áreas do sistema controladas por "caixinha" (permissão). O ACESSO de cada pessoa vem SEMPRE
// destas permissões - o cargo (role) é apenas um rótulo/nome de função que serve de PRESET
// inicial ao cadastrar/editar o colaborador (ver DEFAULT_ROLE_PERMISSIONS). Ex.: dá para liberar
// "alunos" a um Professor, ou "equipe" a qualquer cargo.
export const PERMISSIONS = {
  ALUNOS: "alunos",
  TURMAS: "turmas",
  PRESENCA: "presenca",
  PLANO_AULA: "plano_aula",
  CALENDARIO: "calendario",
  COMUNICACAO: "comunicacao",
  PDIS: "pdis",
  OFICINAS: "oficinas",
  RELATORIOS: "relatorios",
  EQUIPE: "equipe",
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// PRESET de permissões por cargo. NÃO é uma regra de acesso - é só o conjunto que já vem marcado
// ao escolher o cargo na tela de Equipe, e o fallback para contas antigas sem `permissions`
// gravado. Tudo é editável por pessoa (marcar/desmarcar cada caixinha).
//  - Diretor/Coordenador: recebem tudo por padrão (incluindo "equipe").
//  - Secretário: gestão de alunos/turmas/presença/calendário/comunicação.
//  - Professor: presença/aulas/calendário/comunicação (sem "alunos" por padrão - liberável).
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  DIRECTOR: [
    PERMISSIONS.ALUNOS, PERMISSIONS.TURMAS, PERMISSIONS.PRESENCA, PERMISSIONS.PLANO_AULA,
    PERMISSIONS.CALENDARIO, PERMISSIONS.COMUNICACAO, PERMISSIONS.PDIS, PERMISSIONS.OFICINAS,
    PERMISSIONS.RELATORIOS,
  ],
  COORDINATOR: [
    PERMISSIONS.ALUNOS, PERMISSIONS.TURMAS, PERMISSIONS.PRESENCA, PERMISSIONS.PLANO_AULA,
    PERMISSIONS.CALENDARIO, PERMISSIONS.COMUNICACAO, PERMISSIONS.PDIS, PERMISSIONS.OFICINAS,
    PERMISSIONS.RELATORIOS,
  ],
  SECRETARY: [
    PERMISSIONS.ALUNOS, PERMISSIONS.TURMAS, PERMISSIONS.PRESENCA, PERMISSIONS.CALENDARIO,
    PERMISSIONS.COMUNICACAO,
  ],
  TEACHER: [
    PERMISSIONS.PRESENCA, PERMISSIONS.PLANO_AULA, PERMISSIONS.CALENDARIO, PERMISSIONS.COMUNICACAO,
  ],
  ADMIN: [
    PERMISSIONS.ALUNOS, PERMISSIONS.TURMAS, PERMISSIONS.PRESENCA, PERMISSIONS.PLANO_AULA,
    PERMISSIONS.CALENDARIO, PERMISSIONS.COMUNICACAO, PERMISSIONS.PDIS, PERMISSIONS.OFICINAS,
    PERMISSIONS.RELATORIOS,
  ],
  STUDENT: [],
}

export function defaultPermissionsForRole(role?: string): Permission[] {
  return DEFAULT_ROLE_PERMISSIONS[role || ""] ?? []
}

// Fonte única da verdade sobre acesso. O ADMIN é o super-usuário do sistema (sua conta de
// administração) e SEMPRE tem acesso total - por isso nunca fica sem acesso nem se tranca para
// fora. Todos os demais cargos são apenas rótulos: o acesso vem exclusivamente das caixinhas
// (`permissions`) marcadas para aquela pessoa.
export function hasPermission(user: AuthUser | null, permission: Permission) {
  if (!user) return false
  if (user.role === "ADMIN") return true
  return user.permissions?.includes(permission) ?? false
}
