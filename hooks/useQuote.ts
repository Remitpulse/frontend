'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api/client'
import type { Quote } from '@/lib/api/types'
import type { ReceiveCurrency, SendCurrency } from '@/lib/stellar/assets'

/** Debounced quote fetching with a live lock countdown ("Rate locked · 05:00"). */
export function useQuote(params: { sendAmount: string; sendCurrency: SendCurrency; receiveCurrency: ReceiveCurrency }) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const requestId = useRef(0)

  const fetchQuote = useCallback(async () => {
    const amount = Number(params.sendAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setQuote(null)
      return
    }
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const q = await api.getQuote(params)
      if (id === requestId.current) setQuote(q)
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : 'Could not get a quote.')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [params.sendAmount, params.sendCurrency, params.receiveCurrency]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(fetchQuote, 350)
    return () => clearTimeout(t)
  }, [fetchQuote])

  useEffect(() => {
    if (!quote) return setSecondsLeft(0)
    const tick = () => setSecondsLeft(Math.max(0, Math.round((Date.parse(quote.expiresAt) - Date.now()) / 1000)))
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [quote])

  return { quote, loading, error, secondsLeft, expired: !!quote && secondsLeft === 0, refresh: fetchQuote }
}
