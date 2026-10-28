// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Quote } from '@/lib/api/types'

const mockGetQuote = vi.fn()
const mockIsTimeoutError = vi.fn()

vi.mock('@/lib/api/client', () => ({
  api: {
    getQuote: (...args: unknown[]) => mockGetQuote(...args),
  },
  isTimeoutError: (...args: unknown[]) => mockIsTimeoutError(...args),
}))

// Imported after the mock is registered, matching this repo's convention in test/usePasskey.test.tsx.
import { QUOTE_DEBOUNCE_MS, isQuotableAmount, secondsUntil, useQuote } from '@/hooks/useQuote'

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'q_1',
    sendAmount: '500.00',
    sendCurrency: 'USD',
    sendAsset: 'USDC',
    receiveAmount: '8557.85',
    receiveCurrency: 'MXN',
    settlementAsset: 'USDC',
    rate: '17.15',
    fees: { platform: '0.00', partner: '1.00', network: '0.00' },
    amountConverted: '499.00',
    totalCost: '500.00',
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    deliveryEstimate: 'Under 1 minute',
    payTo: 'CPAYTO',
    ...overrides,
  }
}

describe('secondsUntil', () => {
  it('returns the seconds remaining until expiresAt', () => {
    const now = Date.now()
    expect(secondsUntil(new Date(now + 65_000).toISOString(), now)).toBe(65)
  })

  it('clamps to 0 once expiresAt is in the past', () => {
    const now = Date.now()
    expect(secondsUntil(new Date(now - 10_000).toISOString(), now)).toBe(0)
  })

  it('defaults `now` to the current time', () => {
    expect(secondsUntil(new Date(Date.now() + 10_000).toISOString())).toBeGreaterThan(0)
  })
})

describe('isQuotableAmount', () => {
  it('is true for positive, finite amounts', () => {
    expect(isQuotableAmount('500')).toBe(true)
    expect(isQuotableAmount('0.01')).toBe(true)
  })

  it('is false for zero, negative, empty, or non-numeric amounts', () => {
    expect(isQuotableAmount('0')).toBe(false)
    expect(isQuotableAmount('-5')).toBe(false)
    expect(isQuotableAmount('')).toBe(false)
    expect(isQuotableAmount('abc')).toBe(false)
  })
})

describe('useQuote', () => {
  const baseParams = {
    sendAmount: '500',
    sendCurrency: 'USD' as const,
    receiveCurrency: 'MXN' as const,
  }

  beforeEach(() => {
    vi.useFakeTimers()
    mockGetQuote.mockReset()
    mockIsTimeoutError.mockReset()
    mockIsTimeoutError.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches and sets a quote for a valid amount after the debounce delay', async () => {
    const quote = makeQuote()
    mockGetQuote.mockResolvedValue(quote)

    const { result } = renderHook(() => useQuote(baseParams))

    expect(result.current.loading).toBe(false)
    expect(mockGetQuote).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS)
    })

    expect(mockGetQuote).toHaveBeenCalledTimes(1)
    expect(mockGetQuote).toHaveBeenCalledWith(baseParams)
    expect(result.current.quote).toEqual(quote)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('does not fetch and clears the quote for a non-quotable amount', async () => {
    mockGetQuote.mockResolvedValue(makeQuote())
    const { result, rerender } = renderHook((props) => useQuote(props), {
      initialProps: baseParams,
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS)
    })
    expect(result.current.quote).not.toBeNull()

    rerender({ ...baseParams, sendAmount: '0' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS)
    })

    expect(result.current.quote).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(mockGetQuote).toHaveBeenCalledTimes(1) // only the earlier, valid fetch
  })

  it('sets a timeout-specific error message when the request times out', async () => {
    mockGetQuote.mockRejectedValue(new Error('timed out'))
    mockIsTimeoutError.mockReturnValue(true)

    const { result } = renderHook(() => useQuote(baseParams))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS)
    })

    expect(result.current.error).toBe('The quote request timed out. Try again.')
    expect(result.current.quote).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it("surfaces the error's message for a generic failure", async () => {
    mockGetQuote.mockRejectedValue(new Error('rate unavailable'))

    const { result } = renderHook(() => useQuote(baseParams))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS)
    })

    expect(result.current.error).toBe('rate unavailable')
  })

  it('falls back to a generic message for a non-Error rejection', async () => {
    mockGetQuote.mockRejectedValue('nope')

    const { result } = renderHook(() => useQuote(baseParams))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS)
    })

    expect(result.current.error).toBe('Could not get a quote.')
  })

  it('debounces rapid amount changes into a single request for the latest amount', async () => {
    mockGetQuote.mockResolvedValue(makeQuote())
    const { rerender } = renderHook((props) => useQuote(props), {
      initialProps: { ...baseParams, sendAmount: '100' },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    rerender({ ...baseParams, sendAmount: '200' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    rerender({ ...baseParams, sendAmount: '300' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS)
    })

    expect(mockGetQuote).toHaveBeenCalledTimes(1)
    expect(mockGetQuote).toHaveBeenCalledWith(expect.objectContaining({ sendAmount: '300' }))
  })

  it('counts secondsLeft down to 0 and reports expired once the quote lapses', async () => {
    const quote = makeQuote({ expiresAt: new Date(Date.now() + 3_000).toISOString() })
    mockGetQuote.mockResolvedValue(quote)

    const { result } = renderHook(() => useQuote(baseParams))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS)
    })

    expect(result.current.secondsLeft).toBeGreaterThan(0)
    expect(result.current.expired).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })

    expect(result.current.secondsLeft).toBe(0)
    expect(result.current.expired).toBe(true)
  })

  it('refresh() re-fetches immediately, bypassing the debounce delay', async () => {
    mockGetQuote.mockResolvedValue(makeQuote())
    const { result } = renderHook(() => useQuote(baseParams))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS)
    })
    expect(mockGetQuote).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.refresh()
    })

    expect(mockGetQuote).toHaveBeenCalledTimes(2)
  })
})
