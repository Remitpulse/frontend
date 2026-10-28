// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POLL_MS, useTransferStatus } from '@/hooks/useTransferStatus'
import type { TransferStatus } from '@/lib/api/types'

vi.mock('@/lib/api/client', () => ({
  api: {
    getTransfer: vi.fn(),
    transferEventsUrl: vi.fn(),
  },
}))

import { api } from '@/lib/api/client'

type Listener = (event: MessageEvent) => void

class FakeEventSource {
  static instances: FakeEventSource[] = []

  url: string
  onmessage: Listener | null = null
  onerror: ((event: Event) => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }

  emitError() {
    this.onerror?.(new Event('error'))
  }

  close() {
    this.closed = true
  }
}

function makeStatus(overrides: Partial<TransferStatus> = {}): TransferStatus {
  return {
    id: 'tx-1',
    reference: 'RP-1',
    state: 'in_progress',
    stage: 'converted',
    stageTimes: {},
    sendAmount: '100.00',
    sendCurrency: 'USD',
    receiveAmount: '1715.00',
    receiveCurrency: 'MXN',
    rate: '17.15',
    recipientName: 'María López',
    deliveryLabel: 'Bank transfer · SPEI',
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

const inProgress = makeStatus()
const completed = makeStatus({ state: 'completed', stage: 'delivered' })
const failed = makeStatus({ state: 'failed' })

describe('useTransferStatus', () => {
  const originalEventSource = (globalThis as { EventSource?: unknown }).EventSource

  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    vi.mocked(api.getTransfer).mockReset()
    vi.mocked(api.transferEventsUrl).mockReset()
    delete (globalThis as { EventSource?: unknown }).EventSource
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    if (originalEventSource === undefined) {
      delete (globalThis as { EventSource?: unknown }).EventSource
    } else {
      ;(globalThis as { EventSource?: unknown }).EventSource = originalEventSource
    }
  })

  it('does nothing when transferId is null', async () => {
    const { result } = renderHook(() => useTransferStatus(null))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 2)
    })

    expect(api.getTransfer).not.toHaveBeenCalled()
    expect(api.transferEventsUrl).not.toHaveBeenCalled()
    expect(result.current.status).toBeNull()
    expect(result.current.error).toBeNull()
  })

  describe('polling (no EventSource available)', () => {
    it('applies a successful status and schedules another poll', async () => {
      vi.mocked(api.transferEventsUrl).mockReturnValue(null)
      vi.mocked(api.getTransfer).mockResolvedValueOnce(inProgress).mockResolvedValueOnce(inProgress)

      const { result } = renderHook(() => useTransferStatus('tx-1'))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(1)
      expect(api.getTransfer).toHaveBeenCalledWith('tx-1')
      expect(result.current.status).toEqual(inProgress)
      expect(result.current.error).toBeNull()
      expect(result.current.lastSynced).toBeInstanceOf(Date)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(2)
    })

    it('stops polling once a terminal state is reached', async () => {
      vi.mocked(api.transferEventsUrl).mockReturnValue(null)
      vi.mocked(api.getTransfer).mockResolvedValueOnce(inProgress).mockResolvedValueOnce(completed)

      const { result } = renderHook(() => useTransferStatus('tx-1'))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(2)
      expect(result.current.status).toEqual(completed)

      // No further polling once terminal.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS * 3)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(2)
    })

    it('treats "failed" as terminal too', async () => {
      vi.mocked(api.transferEventsUrl).mockReturnValue(null)
      vi.mocked(api.getTransfer).mockResolvedValue(failed)

      const { result } = renderHook(() => useTransferStatus('tx-1'))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.status).toEqual(failed)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS * 3)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(1)
    })

    it('sets an error message on a failed poll but keeps polling', async () => {
      vi.mocked(api.transferEventsUrl).mockReturnValue(null)
      vi.mocked(api.getTransfer)
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce(inProgress)

      const { result } = renderHook(() => useTransferStatus('tx-1'))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.error).toBe('network down')
      expect(result.current.status).toBeNull()

      // Still scheduled another poll after the failure.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(2)
      expect(result.current.status).toEqual(inProgress)
      expect(result.current.error).toBeNull()
    })

    it('falls back to a generic message for a non-Error rejection', async () => {
      vi.mocked(api.transferEventsUrl).mockReturnValue(null)
      vi.mocked(api.getTransfer).mockRejectedValue('boom')

      const { result } = renderHook(() => useTransferStatus('tx-1'))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.error).toBe('Lost connection to transfer updates.')
    })

    it('clears polling timers on unmount', async () => {
      vi.mocked(api.transferEventsUrl).mockReturnValue(null)
      vi.mocked(api.getTransfer).mockResolvedValue(inProgress)

      const { unmount } = renderHook(() => useTransferStatus('tx-1'))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(1)

      unmount()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS * 3)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(1)
    })
  })

  describe('SSE (EventSource available)', () => {
    beforeEach(() => {
      ;(globalThis as { EventSource?: unknown }).EventSource = FakeEventSource
    })

    it('subscribes and applies incoming messages', async () => {
      vi.mocked(api.transferEventsUrl).mockReturnValue('https://example.test/events/tx-1')
      // Initial snapshot fetch that the hook fires alongside the subscription.
      vi.mocked(api.getTransfer).mockResolvedValue(inProgress)

      const { result } = renderHook(() => useTransferStatus('tx-1'))

      expect(FakeEventSource.instances).toHaveLength(1)
      const source = FakeEventSource.instances[0]!
      expect(source.url).toBe('https://example.test/events/tx-1')

      // Let the initial snapshot promise settle.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.status).toEqual(inProgress)

      const updated = makeStatus({ stage: 'settling' })
      act(() => {
        source.emitMessage(updated)
      })

      expect(result.current.status).toEqual(updated)
      expect(result.current.error).toBeNull()
    })

    it('closes the connection and stops once a terminal message arrives', async () => {
      vi.mocked(api.transferEventsUrl).mockReturnValue('https://example.test/events/tx-1')
      vi.mocked(api.getTransfer).mockResolvedValue(inProgress)

      const { result } = renderHook(() => useTransferStatus('tx-1'))

      expect(FakeEventSource.instances).toHaveLength(1)
      const source = FakeEventSource.instances[0]!

      act(() => {
        source.emitMessage(completed)
      })

      expect(result.current.status).toEqual(completed)
      expect(source.closed).toBe(true)
    })

    it('falls back to polling when the connection errors', async () => {
      vi.mocked(api.transferEventsUrl).mockReturnValue('https://example.test/events/tx-1')
      vi.mocked(api.getTransfer)
        .mockResolvedValueOnce(inProgress)
        .mockResolvedValueOnce(inProgress)
        .mockResolvedValueOnce(completed)

      const { result } = renderHook(() => useTransferStatus('tx-1'))

      expect(FakeEventSource.instances).toHaveLength(1)
      const source = FakeEventSource.instances[0]!

      // Consume the initial snapshot call before triggering the error.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(1)

      act(() => {
        source.emitError()
      })
      expect(source.closed).toBe(true)

      // The fallback poll fires immediately.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(2)
      expect(result.current.status).toEqual(inProgress)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(3)
      expect(result.current.status).toEqual(completed)

      // Terminal reached — no further polling.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS * 3)
      })
      expect(api.getTransfer).toHaveBeenCalledTimes(3)
    })

    it('closes the subscription on unmount', async () => {
      vi.mocked(api.transferEventsUrl).mockReturnValue('https://example.test/events/tx-1')
      vi.mocked(api.getTransfer).mockResolvedValue(inProgress)

      const { unmount } = renderHook(() => useTransferStatus('tx-1'))

      expect(FakeEventSource.instances).toHaveLength(1)
      const source = FakeEventSource.instances[0]!

      unmount()

      expect(source.closed).toBe(true)
    })
  })
})
