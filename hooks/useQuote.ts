'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, isTimeoutError } from '@/lib/api/client'
import type { Quote } from '@/lib/api/types'
import type { ReceiveCurrency, SendCurrency } from '@/lib/stellar/assets'

export const QUOTE_DEBOUNCE_MS = 350

/** Pure helper: seconds remaining until `expiresAt`, clamped at 0. */
export function secondsUntil(expiresAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.round((Date.parse(expiresAt) - now) / 1000))
}

/** Pure helper: whether a positive, finite amount should trigger a quote fetch. */
export function isQuotableAmount(sendAmount: string): boolean {
  const amount = Number(sendAmount)
  return Number.isFinite(amount) && amount > 0
}

/** Debounced quote fetching with a live lock countdown ("Rate locked · 05:00"). */
export function useQuote(params: {
  sendAmount: string
  sendCurrency: SendCurrency
  receiveCurrency: ReceiveCurrency
}) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(0)
  const { sendAmount, sendCurrency, receiveCurrency } = params
  const requestId = useRef(0)

  const fetchQuote = useCallback(async () => {
    if (!isQuotableAmount(sendAmount)) {
      // Invalidate any in-flight request so its response is ignored.
      requestId.current++
      setQuote(null)
      setLoading(false)
      setError(null)
      return
    }
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const q = await api.getQuote({ sendAmount, sendCurrency, receiveCurrency })
      if (id === requestId.current) {
        setQuote(q)
        setNow(Date.now())
      }
    } catch (err) {
      if (id === requestId.current) {
        setError(
          isTimeoutError(err)
            ? 'The quote request timed out. Try again.'
            : err instanceof Error
              ? err.message
              : 'Could not get a quote.',
        )
      }
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [sendAmount, sendCurrency, receiveCurrency])

  const invalidateRequest = useCallback(() => {
    requestId.current++
  }, [])

  useEffect(() => {
    const t = setTimeout(fetchQuote, QUOTE_DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      invalidateRequest()
    }
  }, [fetchQuote, invalidateRequest])

  useEffect(() => {
    if (!quote) return
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [quote])

  const visibleQuote =
    quote &&
    Number(quote.sendAmount) === Number(sendAmount) &&
    quote.sendCurrency === sendCurrency &&
    quote.receiveCurrency === receiveCurrency
      ? quote
      : null
  const secondsLeft = visibleQuote ? secondsUntil(visibleQuote.expiresAt, now) : 0

  return {
    quote: visibleQuote,
    loading,
    error,
    secondsLeft,
    expired: !!visibleQuote && secondsLeft === 0,
    refresh: fetchQuote,
  }
}
