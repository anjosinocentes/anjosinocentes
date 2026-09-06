const USER_KEY = "anjos_user"
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api"

export type UserRole = "ADMIN" | "DIRECTOR" | "COORDINATOR" | "SECRETARY" | "TEACHER" | "STUDENT"

export type AuthUser = {
  id: string
  name: string
  email: string
  role: UserRole
  permissions: string[]
  avatarUrl?: string | null
}

function isBrowser() {
  return typeof window !== "undefined"
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) return null
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

// O token de sessão vive apenas no cookie httpOnly (definido pelo servidor no login) e NUNCA é
// exposto ao JavaScript - por isso aqui guardamos só o objeto de usuário, para exibir na UI sem
// um round-trip. A autenticação das chamadas /api acontece automaticamente pelo cookie.
export function saveSession(user: AuthUser) {
  if (!isBrowser()) return
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  if (!isBrowser()) return
  window.localStorage.removeItem(USER_KEY)
  // O cookie httpOnly só pode ser apagado pelo servidor.
  fetch(`${targetApi()}/auth/logout`, { method: "POST" }).catch(() => {})
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    return {} as T
  }
}

export async function loginRequest(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${targetApi()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })

  // O servidor responde com Set-Cookie (httpOnly) contendo o token; o cliente só recebe o usuário.
  const data = await parseJson<{ user?: AuthUser; error?: string }>(res)
  if (res.ok && data.user) {
    return data.user
  }

  throw new Error(data.error || "Credenciais inválidas ou serviço indisponível")
}

// Tenta renovar a sessão usando o cookie de refresh. Retorna true se um novo access foi emitido.
export async function refreshSession(): Promise<boolean> {
  try {
    const res = await fetch(`${targetApi()}/auth/refresh`, { method: "POST" })
    return res.ok
  } catch {
    return false
  }
}

export async function meRequest(): Promise<AuthUser> {
  let res: Response
  try {
    // Sem header Authorization: a sessão é autenticada pelo cookie httpOnly (enviado automaticamente).
    res = await fetch(`${targetApi()}/auth/me`)
  } catch (e) {
    // Falha de rede (backend inacessível) - mantém a sessão em cache pra não deslogar à toa.
    const storedUser = getStoredUser()
    if (storedUser) return storedUser
    throw new Error("Sessão inválida")
  }

  if (res.ok) {
    const data = await parseJson<{ user?: AuthUser; error?: string }>(res)
    if (data.user) return data.user
  }

  // 401: o access token pode ter apenas expirado. Tenta renovar via refresh e refaz /auth/me uma vez.
  if (res.status === 401 && (await refreshSession())) {
    const retry = await fetch(`${targetApi()}/auth/me`)
    if (retry.ok) {
      const data = await parseJson<{ user?: AuthUser; error?: string }>(retry)
      if (data.user) return data.user
    }
  }

  // O servidor respondeu (não é falha de rede): o token é realmente inválido/expirado. Não usar o
  // fallback do cache aqui - o AuthProvider depende desse throw pra saber que precisa deslogar
  // (chamar clearSession), senão uma sessão quebrada fica sendo regravada no localStorage pra sempre.
  throw new Error("Sessão inválida ou expirada")
}

function targetApi() {
  return (typeof window !== "undefined" && window.location.hostname !== "localhost")
    ? "/api"
    : (API_URL || "/api")
}

export async function forgotPasswordRequest(email: string): Promise<string> {
  const res = await fetch(`${targetApi()}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  const data = await parseJson<{ message?: string; error?: string }>(res)
  if (res.status === 429) {
    throw new Error(data.error || "Muitas solicitações. Aguarde alguns minutos antes de tentar novamente.")
  }
  if (!res.ok) {
    throw new Error(data.error || "Não foi possível processar sua solicitação. Tente novamente.")
  }
  return data.message || "Se o e-mail informado estiver cadastrado, você receberá um link para redefinir sua senha."
}

export type ResetTokenCheck = { valid: boolean; reason: "expired" | "used" | "invalid" | null }

export async function validateResetToken(token: string): Promise<ResetTokenCheck> {
  try {
    const res = await fetch(`${targetApi()}/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
    const data = await parseJson<ResetTokenCheck>(res)
    return { valid: !!data.valid, reason: data.reason ?? "invalid" }
  } catch {
    return { valid: false, reason: "invalid" }
  }
}

export async function resetPasswordRequest(token: string, password: string, confirmPassword: string): Promise<void> {
  const res = await fetch(`${targetApi()}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password, confirmPassword }),
  })
  const data = await parseJson<{ success?: boolean; error?: string }>(res)
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Não foi possível redefinir a senha. Tente novamente.")
  }
}

