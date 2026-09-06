"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { AuthUser } from "@/lib/auth"
import { clearSession, getStoredUser, loginRequest, meRequest, saveSession } from "@/lib/auth"

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateUserState: (user: AuthUser) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cachedUser = getStoredUser()

    // Sem usuário em cache: provavelmente não está logado. Evita um /auth/me que daria 401 à toa.
    if (!cachedUser) {
      setLoading(false)
      return
    }

    // Otimista: mostra o usuário do cache e valida a sessão pelo cookie httpOnly.
    setUser(cachedUser)
    meRequest()
      .then((freshUser) => {
        saveSession(freshUser)
        setUser(freshUser)
      })
      .catch(() => {
        clearSession()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const loggedUser = await loginRequest(email, password)
    saveSession(loggedUser)
    setUser(loggedUser)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const updateUserState = useCallback((updatedUser: AuthUser) => {
    saveSession(updatedUser)
    setUser(updatedUser)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      updateUserState,
    }),
    [user, loading, login, logout, updateUserState],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
