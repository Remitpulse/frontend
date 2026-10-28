// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSigner } from '@/lib/stellar/smartAccount'
import { AUTH_TTL_LEDGERS } from '@/lib/stellar/smartAccount'
import type { FundingSource, Quote, Recipient } from '@/lib/api/types'

const mockUseAuth = vi.fn()
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockCreateTransfer = vi.fn()
vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client')
  return {
    ...actual,
    api: { createTransfer: (...args: unknown[]) => mockCreateTransfer(...args) },
  }
})

const mockUsePasskey = vi.fn()
vi.mock('@/hooks/usePasskey', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/usePasskey')>('@/hooks/usePasskey')
  return {
    ...actual,
    usePasskey: () => mockUsePasskey(),
  }
})

const mockUseSessionKey = vi.fn()
vi.mock('@/hooks/useSessionKey', () => ({
  useSessionKey: () => mockUseSessionKey(),
}))

vi.mock('@/lib/config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
  return { ...actual, config: { ...actual.config, demoMode: true } }
})

// Import after mocks are registered.
const {
  useSendTransfer,
  resolveWillUseSessionKey,
  selectSigner,
  authTtlForFunding,
  signDemoPayload,
} = await import('@/hooks/useSendTransfer')

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function fakeScVal(tag: string) {
  return { toXdr: (format: string) => `${tag}-xdr-${format}` } as unknown as Awaited<
    ReturnType<AuthSigner>
  >
}

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
    payTo: 'CPAYOUT',
    ...overrides,
  }
}

const RECIPIENT: Recipient = {
  firstName: 'María',
  lastName: 'López',
  country: 'MX',
  payoutMethod: 'bank',
}

function makeSendInput(overrides: Partial<{ quote: Quote; funding: FundingSource }> = {}) {
  return {
    quote: overrides.quote ?? makeQuote(),
    recipient: RECIPIENT,
    saveRecipient: false,
    funding: overrides.funding ?? ('wallet' as FundingSource),
  }
}

// ---------------------------------------------------------------------------
// Pure helper unit tests
// ---------------------------------------------------------------------------

describe('resolveWillUseSessionKey', () => {
  it('is true when the session signer covers the amount', () => {
    const signerFor = () => (async () => fakeScVal('session')) as AuthSigner
    expect(resolveWillUseSessionKey(signerFor, '10')).toBe(true)
  })

  it('is false when there is no session signer', () => {
    const signerFor = () => null
    expect(resolveWillUseSessionKey(signerFor, '10000')).toBe(false)
  })
})

describe('selectSigner', () => {
  it('picks the session signer when it covers the amount', () => {
    const sessionSigner: AuthSigner = async () => fakeScVal('session')
    const passkeySigner: AuthSigner = async () => fakeScVal('passkey')
    const signerFor = vi.fn().mockReturnValue(sessionSigner)

    const { signer, usedSessionKey } = selectSigner(signerFor, passkeySigner, '10')

    expect(signer).toBe(sessionSigner)
    expect(usedSessionKey).toBe(true)
    expect(signerFor).toHaveBeenCalledWith(10)
  })

  it('falls back to the passkey signer when there is no session signer', () => {
    const passkeySigner: AuthSigner = async () => fakeScVal('passkey')
    const signerFor = vi.fn().mockReturnValue(null)

    const { signer, usedSessionKey } = selectSigner(signerFor, passkeySigner, '10000')

    expect(signer).toBe(passkeySigner)
    expect(usedSessionKey).toBe(false)
  })
})

describe('authTtlForFunding', () => {
  it('uses the deferred TTL for partner funding', () => {
    expect(authTtlForFunding('partner')).toBe(AUTH_TTL_LEDGERS.deferred)
  })

  it('uses the immediate TTL for wallet funding', () => {
    expect(authTtlForFunding('wallet')).toBe(AUTH_TTL_LEDGERS.immediate)
  })
})

describe('signDemoPayload', () => {
  it('signs a 32-byte hash of the quote id and returns base64 XDR', async () => {
    const signer = vi.fn(async (payload: Uint8Array) => {
      expect(payload).toBeInstanceOf(Uint8Array)
      expect(payload).toHaveLength(32)
      return fakeScVal('demo')
    }) as unknown as AuthSigner

    const xdr = await signDemoPayload(signer, 'q_42')

    expect(signer).toHaveBeenCalledTimes(1)
    expect(xdr).toBe('demo-xdr-base64')
  })
})

// ---------------------------------------------------------------------------
// useSendTransfer hook tests
// ---------------------------------------------------------------------------

describe('useSendTransfer', () => {
  const passkeySigner: AuthSigner = vi.fn(async () => fakeScVal('passkey'))

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      session: { contractId: 'CACCOUNT', credentialId: 'cred-1', displayName: 'Ada', token: 't' },
    })
    mockUsePasskey.mockReturnValue({
      signer: passkeySigner,
      signPayload: vi.fn(),
      status: 'idle',
      error: null,
      isBusy: false,
    })
    mockUseSessionKey.mockReturnValue({ signerFor: () => null })
    mockCreateTransfer.mockResolvedValue({ transferId: 'tr_1' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts idle and not busy', () => {
    const { result } = renderHook(() => useSendTransfer())
    expect(result.current.phase).toBe('idle')
    expect(result.current.isBusy).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('willUseSessionKey delegates to the session key signerFor', () => {
    const signerFor = vi.fn().mockReturnValue(null)
    mockUseSessionKey.mockReturnValue({ signerFor })

    const { result } = renderHook(() => useSendTransfer())
    const willUse = result.current.willUseSessionKey('10')

    expect(willUse).toBe(false)
    expect(signerFor).toHaveBeenCalledWith(10)
  })

  it('send() succeeds using the session-key signer when it covers the amount', async () => {
    const sessionSigner: AuthSigner = vi.fn(async () => fakeScVal('session'))
    mockUseSessionKey.mockReturnValue({ signerFor: () => sessionSigner })

    const { result } = renderHook(() => useSendTransfer())

    let response: unknown
    await act(async () => {
      response = await result.current.send(makeSendInput())
    })

    expect(sessionSigner).toHaveBeenCalledTimes(1)
    expect(passkeySigner).not.toHaveBeenCalled()
    expect(mockCreateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteId: 'q_1',
        signer: 'session',
        signedXdr: 'session-xdr-base64',
      }),
    )
    expect(response).toEqual({ transferId: 'tr_1' })
    expect(result.current.phase).toBe('done')
    expect(result.current.error).toBeNull()
  })

  it('send() falls back to the passkey signer when the session key does not cover the amount', async () => {
    mockUseSessionKey.mockReturnValue({ signerFor: () => null })

    const { result } = renderHook(() => useSendTransfer())

    await act(async () => {
      await result.current.send(makeSendInput())
    })

    expect(passkeySigner).toHaveBeenCalledTimes(1)
    expect(mockCreateTransfer).toHaveBeenCalledWith(expect.objectContaining({ signer: 'passkey' }))
    expect(result.current.phase).toBe('done')
  })

  it('reaches the submitting phase before resolving', async () => {
    let resolveCreate: (value: { transferId: string }) => void = () => {}
    mockCreateTransfer.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve
      }),
    )

    const { result } = renderHook(() => useSendTransfer())

    let sendPromise!: Promise<unknown>
    act(() => {
      sendPromise = result.current.send(makeSendInput())
    })

    await waitFor(() => expect(result.current.phase).toBe('submitting'))
    expect(result.current.isBusy).toBe(true)

    await act(async () => {
      resolveCreate({ transferId: 'tr_2' })
      await sendPromise
    })

    expect(result.current.phase).toBe('done')
  })

  it('send() sets a timeout-specific error and resets to idle when the request times out', async () => {
    const { ApiError } = await import('@/lib/api/client')
    mockCreateTransfer.mockRejectedValue(
      new ApiError('Request timed out. Please try again.', 0, 'timeout'),
    )

    const { result } = renderHook(() => useSendTransfer())

    await act(async () => {
      await expect(result.current.send(makeSendInput())).rejects.toBeInstanceOf(ApiError)
    })

    expect(result.current.phase).toBe('idle')
    expect(result.current.error).toBe(
      'The transfer request timed out. Your money has not moved — please try again.',
    )
  })

  it('send() sets a generic error and the error phase on other failures', async () => {
    mockCreateTransfer.mockRejectedValue(new Error('relay rejected the transfer'))

    const { result } = renderHook(() => useSendTransfer())

    await act(async () => {
      await expect(result.current.send(makeSendInput())).rejects.toThrow(
        'relay rejected the transfer',
      )
    })

    expect(result.current.phase).toBe('error')
    expect(result.current.error).toBe('relay rejected the transfer')
  })

  it('send() throws without touching phase/error when there is no session', async () => {
    mockUseAuth.mockReturnValue({ session: null })

    const { result } = renderHook(() => useSendTransfer())

    await act(async () => {
      await expect(result.current.send(makeSendInput())).rejects.toThrow(
        'Log in with your passkey first.',
      )
    })

    expect(mockCreateTransfer).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('idle')
    expect(result.current.error).toBeNull()
  })
})
