'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { setAuthToken } from '@/lib/api/client'
import type { Session } from '@/lib/api/types'
import { clearSessionKey } from '@/lib/stellar/sessionKeys'

const STORAGE_KEY = 'rp-session'

interface AuthContextValue {
  session: Session | null
  ready: boolean
  signIn: (session: Session) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const s = JSON.parse(raw) as Session
        setAuthToken(s.token)
        setSession(s)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    setReady(true)
  }, [])

  const signIn = useCallback((s: Session) => {
    setAuthToken(s.token)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    setSession(s)
  }, [])

  const signOut = useCallback(async () => {
    setAuthToken(null)
    localStorage.removeItem(STORAGE_KEY)
    await clearSessionKey()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ session, ready, signIn, signOut }),
    [session, ready, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
