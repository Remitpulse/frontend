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
import type { FundingSource, Quote, Recipient } from '@/lib/api/types'
import type { ReceiveCurrency, SendCurrency } from '@/lib/stellar/assets'

export interface TransferDraft {
  sendAmount: string
  sendCurrency: SendCurrency
  receiveCurrency: ReceiveCurrency
  payoutMethod: 'bank' | 'cash'
  quote: Quote | null
  recipient: Recipient | null
  saveRecipient: boolean
  funding: FundingSource
}

const INITIAL: TransferDraft = {
  sendAmount: '500.00',
  sendCurrency: 'USD',
  receiveCurrency: 'MXN',
  payoutMethod: 'bank',
  quote: null,
  recipient: null,
  saveRecipient: true,
  funding: 'partner',
}

const STORAGE_KEY = 'rp-transfer-draft'

interface DraftContextValue {
  draft: TransferDraft
  update: (patch: Partial<TransferDraft>) => void
  reset: () => void
}

const DraftContext = createContext<DraftContextValue | null>(null)

/**
 * Clears the persisted transfer draft. Safe to call outside React (e.g. on
 * sign-out from AuthProvider, which wraps this provider) so a different
 * account signing in on the same tab can't inherit the previous draft.
 */
const draftStore = createClientStore<TransferDraft>(INITIAL, () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? { ...INITIAL, ...(JSON.parse(raw) as Partial<TransferDraft>) } : INITIAL
  } catch {
    return INITIAL
  }
})

export function clearTransferDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable */
  }
  draftStore.set(INITIAL)
}

/** Multi-step send flow state, persisted per tab so a refresh mid-flow is safe. */
export function TransferDraftProvider({ children }: { children: ReactNode }) {
  const { value: draft, ready } = useSyncExternalStore(
    draftStore.subscribe,
    draftStore.getSnapshot,
    draftStore.getServerSnapshot,
  )
  const update = useCallback((patch: Partial<TransferDraft>) => {
    const next = { ...draftStore.getSnapshot().value, ...patch }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* in-memory draft */
    }
    draftStore.set(next)
  }, [])
  const reset = useCallback(() => clearTransferDraft(), [])

  const value = useMemo(() => ({ draft, update, reset }), [draft, update, reset])
  return <DraftContext.Provider value={value}>{ready ? children : null}</DraftContext.Provider>
}

export function useTransferDraft() {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useTransferDraft must be used inside <TransferDraftProvider>')
  return ctx
}
