// Regras de senha para o fluxo de redefinição. Usado tanto no formulário (feedback visual)
// quanto na API (nunca confiar só na validação do cliente).
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72 // bcrypt ignora bytes além de 72

export type PasswordRequirement = {
  key: string
  label: string
  test: (password: string) => boolean
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { key: "length", label: "Pelo menos 8 caracteres", test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { key: "uppercase", label: "Uma letra maiúscula", test: (p) => /[A-Z]/.test(p) },
  { key: "lowercase", label: "Uma letra minúscula", test: (p) => /[a-z]/.test(p) },
  { key: "number", label: "Um número", test: (p) => /[0-9]/.test(p) },
  { key: "special", label: "Um caractere especial", test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export function getPasswordValidationError(password: string): string | null {
  if (!password) return "A senha é obrigatória"
  if (/\s/.test(password)) return "A senha não pode conter espaços"
  if (password.length > PASSWORD_MAX_LENGTH) return `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres`
  const failed = PASSWORD_REQUIREMENTS.find((req) => !req.test(password))
  if (failed) return `A senha precisa atender a todos os requisitos de segurança`
  return null
}

export function isPasswordValid(password: string): boolean {
  return getPasswordValidationError(password) === null
}
