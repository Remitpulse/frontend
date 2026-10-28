'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api/client'
import type { TransferStatus } from '@/lib/api/types'

export const POLL_MS = 2_000
export const TERMINAL_STATES: ReadonlySet<string> = new Set(['completed', 'failed'])
const TERMINAL = TERMINAL_STATES

/**
 * Live transfer status. Prefers the backend's SSE stream and falls back to
 * polling if the stream is unavailable or drops.
 */
export function useTransferStatus(transferId: string | null) {
  const [status, setStatus] = useState<TransferStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)

  useEffect(() => {
    if (!transferId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let source: EventSource | null = null

    const apply = (s: TransferStatus) => {
      if (cancelled) return
      setStatus(s)
      setError(null)
      setLastSynced(new Date())
    }

    const poll = async () => {
      try {
        const s = await api.getTransfer(transferId)
        apply(s)
        if (TERMINAL.has(s.state)) return
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Lost connection to transfer updates.')
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS)
    }

    const url = api.transferEventsUrl(transferId)
    if (url && typeof EventSource !== 'undefined') {
      source = new EventSource(url, { withCredentials: true })
      source.onmessage = (e) => {
        const s = JSON.parse(e.data) as TransferStatus
        apply(s)
        if (TERMINAL.has(s.state)) source?.close()
      }
      source.onerror = () => {
        source?.close()
        source = null
        if (!cancelled) poll()
      }
      // Initial snapshot so the UI isn't empty until the first event.
      api.getTransfer(transferId).then(apply, () => {})
    } else {
      poll()
    }

    return () => {
      cancelled = true
      clearTimeout(timer)
      source?.close()
    }
  }, [transferId])

  return { status, error, lastSynced }
}
