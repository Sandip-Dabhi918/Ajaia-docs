"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"

// ── Types ──────────────────────────────────────────────────────────────────────

export type FakeUser = {
  email: string
  displayName: string
}

type AuthContextValue = {
  user: FakeUser | null
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
  loading: boolean
}

// ── Storage key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "ajaia_current_user"

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FakeUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Rehydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setUser(JSON.parse(stored) as FakeUser)
      }
    } catch {
      // Corrupted storage — ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const persist = (u: FakeUser | null) => {
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    setUser(u)
  }

  /**
   * Login: any email + any password works.
   * We derive a display name from the email prefix (e.g. "alice@test.com" → "Alice").
   */
  const login = useCallback(async (email: string, _password: string) => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) throw new Error("Email is required")
    const displayName =
      trimmed.split("@")[0].charAt(0).toUpperCase() +
      trimmed.split("@")[0].slice(1)
    persist({ email: trimmed, displayName })
  }, [])

  /**
   * Signup: same as login but caller provides a display name explicitly.
   */
  const signup = useCallback(
    async (email: string, _password: string, displayName: string) => {
      const trimmed = email.trim().toLowerCase()
      if (!trimmed) throw new Error("Email is required")
      const name = displayName.trim() || trimmed.split("@")[0]
      persist({ email: trimmed, displayName: name })
    },
    []
  )

  const logout = useCallback(() => {
    persist(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}