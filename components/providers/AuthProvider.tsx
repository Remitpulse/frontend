'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createClientStore } from '@/lib/clientStore'
import { setAuthToken } from '@/lib/api/client'
import type { Session } from '@/lib/api/types'
import { clearSessionKey } from '@/lib/stellar/sessionKeys'
import { clearAsyncDataCache } from '@/hooks/useAsyncData'
import { clearTransferDraft } from '@/components/providers/TransferDraftProvider'

const STORAGE_KEY = 'rp-session'

interface AuthContextValue {
  session: Session | null
  ready: boolean
  signIn: (session: Session) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<Session>
  return ['token', 'contractId', 'credentialId', 'displayName'].every(
    (field) => typeof session[field as keyof Session] === 'string',
  )
}

const sessionStore = createClientStore<Session | null>(null, () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const value: unknown = raw ? JSON.parse(raw) : null
    if (isSession(value)) {
      setAuthToken(value.token)
      return value
    }
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be unavailable; an in-memory sign-in is still possible.
  }
  return null
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const { value: session, ready } = useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSnapshot,
    sessionStore.getServerSnapshot,
  )

  const signIn = useCallback((s: Session) => {
    setAuthToken(s.token)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch {
      /* memory session */
    }
    sessionStore.set(s)
  }, [])

  const signOut = useCallback(async () => {
    setAuthToken(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable */
    }
    sessionStore.set(null)
    // Drop all cached client state so a different account signing in on the
    // same tab can't see the previous account's transfers/recipients/balance.
    clearAsyncDataCache()
    clearTransferDraft()
    await clearSessionKey()
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
