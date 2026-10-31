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
export function clearTransferDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* sessionStorage unavailable; nothing to clear */
  }
}

/** Multi-step send flow state, persisted per tab so a refresh mid-flow is safe. */
export function TransferDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<TransferDraft>(INITIAL)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) setDraft({ ...INITIAL, ...(JSON.parse(raw) as Partial<TransferDraft>) })
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const update = useCallback((patch: Partial<TransferDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const reset = useCallback(() => {
    clearTransferDraft()
    setDraft(INITIAL)
  }, [])

  const value = useMemo(() => ({ draft, update, reset }), [draft, update, reset])
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

export function useTransferDraft() {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useTransferDraft must be used inside <TransferDraftProvider>')
  return ctx
}
