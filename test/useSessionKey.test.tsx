// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useSessionKey,
  loadSessionKeyRecord,
  sessionSignerFor,
  isSessionKeyActive,
  issueSessionKey,
} from '@/hooks/useSessionKey'
import type { SessionKeyRecord } from '@/lib/stellar/sessionKeys'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseAuth = vi.fn()
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockSignPayload = vi.fn()
const mockSigner = vi.fn()
const mockUsePasskey = vi.fn()
vi.mock('@/hooks/usePasskey', () => ({
  usePasskey: () => mockUsePasskey(),
}))

const mockIssueSessionKeyApi = vi.fn()
const mockConfirmSessionKey = vi.fn()
vi.mock('@/lib/api/client', () => ({
  api: {
    issueSessionKey: (...args: unknown[]) => mockIssueSessionKeyApi(...args),
    confirmSessionKey: (...args: unknown[]) => mockConfirmSessionKey(...args),
  },
  isTimeoutError: () => false,
}))

const mockSignPreparedXdr = vi.fn()
vi.mock('@/lib/stellar/smartAccount', async () => {
  const actual = await vi.importActual<typeof import('@/lib/stellar/smartAccount')>(
    '@/lib/stellar/smartAccount',
  )
  return {
    ...actual,
    signPreparedXdr: (...args: unknown[]) => mockSignPreparedXdr(...args),
  }
})

const mockClearSessionKey = vi.fn()
const mockGenerateSessionKey = vi.fn()
const mockLoadSessionKey = vi.fn()
const mockSaveSessionKey = vi.fn()
const mockSessionKeyCovers = vi.fn()
const mockSignWithSessionKey = vi.fn()
const mockSupportsEd25519SessionKeys = vi.fn()
vi.mock('@/lib/stellar/sessionKeys', () => ({
  clearSessionKey: (...args: unknown[]) => mockClearSessionKey(...args),
  generateSessionKey: (...args: unknown[]) => mockGenerateSessionKey(...args),
  loadSessionKey: (...args: unknown[]) => mockLoadSessionKey(...args),
  saveSessionKey: (...args: unknown[]) => mockSaveSessionKey(...args),
  sessionKeyCovers: (...args: unknown[]) => mockSessionKeyCovers(...args),
  signWithSessionKey: (...args: unknown[]) => mockSignWithSessionKey(...args),
  supportsEd25519SessionKeys: (...args: unknown[]) => mockSupportsEd25519SessionKeys(...args),
}))

const mockEd25519SignatureScVal = vi.fn()
vi.mock('@/lib/stellar/signatures', () => ({
  ed25519SignatureScVal: (...args: unknown[]) => mockEd25519SignatureScVal(...args),
}))

const mockConfig = vi.hoisted(() => ({
  demoMode: true,
  sessionKey: { maxAmount: 50, ttlMinutes: 30 },
}))
vi.mock('@/lib/config', () => ({ config: mockConfig }))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONTRACT_ID = 'CCONTRACTADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
const PUBLIC_KEY = new Uint8Array(32).fill(7)
const FAKE_PRIVATE_KEY = { type: 'private' } as unknown as CryptoKey

function makeRecord(overrides: Partial<SessionKeyRecord> = {}): SessionKeyRecord {
  return {
    id: 'active',
    contractId: CONTRACT_ID,
    privateKey: FAKE_PRIVATE_KEY,
    publicKey: PUBLIC_KEY,
    maxAmount: 50,
    expiresAt: Date.now() + 60_000,
    registered: true,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockConfig.demoMode = true
  mockConfig.sessionKey = { maxAmount: 50, ttlMinutes: 30 }

  mockUseAuth.mockReturnValue({ session: { contractId: CONTRACT_ID } })
  mockUsePasskey.mockReturnValue({ signPayload: mockSignPayload, signer: mockSigner })

  mockLoadSessionKey.mockResolvedValue(null)
  mockSupportsEd25519SessionKeys.mockReturnValue(true)
  mockSaveSessionKey.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Pure helper unit tests
// ---------------------------------------------------------------------------

describe('loadSessionKeyRecord', () => {
  it('resolves with the stored record', async () => {
    const record = makeRecord()
    mockLoadSessionKey.mockResolvedValueOnce(record)
    await expect(loadSessionKeyRecord(CONTRACT_ID)).resolves.toEqual(record)
    expect(mockLoadSessionKey).toHaveBeenCalledWith(CONTRACT_ID)
  })

  it('resolves to null when nothing is stored', async () => {
    mockLoadSessionKey.mockResolvedValueOnce(null)
    await expect(loadSessionKeyRecord(CONTRACT_ID)).resolves.toBeNull()
  })

  it('resolves to null instead of throwing when the lookup fails', async () => {
    mockLoadSessionKey.mockRejectedValueOnce(new Error('indexeddb unavailable'))
    await expect(loadSessionKeyRecord(CONTRACT_ID)).resolves.toBeNull()
  })
})

describe('isSessionKeyActive', () => {
  it('is false for a null record', () => {
    expect(isSessionKeyActive(null)).toBe(false)
  })

  it('is true for a registered, non-expired record', () => {
    expect(
      isSessionKeyActive(makeRecord({ registered: true, expiresAt: Date.now() + 60_000 })),
    ).toBe(true)
  })

  it('is false for an expired record', () => {
    expect(isSessionKeyActive(makeRecord({ registered: true, expiresAt: Date.now() - 1 }))).toBe(
      false,
    )
  })

  it('is false for an unregistered record', () => {
    expect(
      isSessionKeyActive(makeRecord({ registered: false, expiresAt: Date.now() + 60_000 })),
    ).toBe(false)
  })
})

describe('sessionSignerFor', () => {
  it('returns null when the record does not cover the amount', () => {
    mockSessionKeyCovers.mockReturnValue(false)
    expect(sessionSignerFor(null, 100)).toBeNull()
    expect(mockSessionKeyCovers).toHaveBeenCalledWith(null, 100)
  })

  it('returns a signer that delegates to signWithSessionKey + ed25519SignatureScVal', async () => {
    const record = makeRecord()
    mockSessionKeyCovers.mockReturnValue(true)
    const rawSignature = new Uint8Array(64).fill(9)
    const scVal = { type: 'scvVec' }
    mockSignWithSessionKey.mockResolvedValue(rawSignature)
    mockEd25519SignatureScVal.mockReturnValue(scVal)

    const signer = sessionSignerFor(record, 10)
    expect(signer).not.toBeNull()

    const payload = new Uint8Array(32).fill(1)
    const result = await signer!(payload)

    expect(mockSignWithSessionKey).toHaveBeenCalledWith(record, payload)
    expect(mockEd25519SignatureScVal).toHaveBeenCalledWith(record.publicKey, rawSignature)
    expect(result).toBe(scVal)
  })
})

describe('issueSessionKey (pure helper)', () => {
  const baseDeps = {
    contractId: CONTRACT_ID,
    maxAmount: 50,
    ttlMinutes: 30,
    issueSessionKey: (...args: unknown[]) => mockIssueSessionKeyApi(...args),
    confirmSessionKey: (...args: unknown[]) => mockConfirmSessionKey(...args),
    signPreparedXdr: (...args: unknown[]) => mockSignPreparedXdr(...args),
  } as const

  it('demo mode: signs the public key hash with the passkey and saves a registered record', async () => {
    const generated = makeRecord({ registered: false })
    mockGenerateSessionKey.mockResolvedValue(generated)
    mockSignPayload.mockResolvedValue({ signature: new Uint8Array(64) })

    const result = await issueSessionKey({
      ...baseDeps,
      passkey: { signPayload: mockSignPayload, signer: mockSigner },
      demoMode: true,
    })

    expect(mockSignPayload).toHaveBeenCalledTimes(1)
    expect(mockIssueSessionKeyApi).not.toHaveBeenCalled()
    expect(mockSaveSessionKey).toHaveBeenCalledWith({ ...generated, registered: true })
    expect(result).toEqual({ ...generated, registered: true })
  })

  it('live mode: issues via the backend, signs the prepared xdr, and confirms', async () => {
    const generated = makeRecord({ registered: false })
    mockGenerateSessionKey.mockResolvedValue(generated)
    mockIssueSessionKeyApi.mockResolvedValue({ xdr: 'unsigned-xdr' })
    mockSignPreparedXdr.mockResolvedValue('signed-xdr')
    mockConfirmSessionKey.mockResolvedValue({ hash: 'tx-hash' })

    const result = await issueSessionKey({
      ...baseDeps,
      passkey: { signPayload: mockSignPayload, signer: mockSigner },
      demoMode: false,
    })

    expect(mockIssueSessionKeyApi).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: CONTRACT_ID, maxAmount: generated.maxAmount }),
    )
    expect(mockSignPreparedXdr).toHaveBeenCalledWith(
      expect.objectContaining({ xdr: 'unsigned-xdr', accountId: CONTRACT_ID, signer: mockSigner }),
    )
    expect(mockConfirmSessionKey).toHaveBeenCalledWith({
      contractId: CONTRACT_ID,
      signedXdr: 'signed-xdr',
    })
    expect(mockSignPayload).not.toHaveBeenCalled()
    expect(result).toEqual({ ...generated, registered: true })
  })
})

// ---------------------------------------------------------------------------
// useSessionKey hook tests
// ---------------------------------------------------------------------------

describe('useSessionKey', () => {
  it('exposes active=false when no record is stored', async () => {
    mockLoadSessionKey.mockResolvedValue(null)

    const { result } = renderHook(() => useSessionKey())

    await waitFor(() => expect(result.current.record).toBeNull())
    expect(result.current.active).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('reflects active=true for a registered, non-expired stored record', async () => {
    const record = makeRecord({ registered: true, expiresAt: Date.now() + 60_000 })
    mockLoadSessionKey.mockResolvedValue(record)

    const { result } = renderHook(() => useSessionKey())

    await waitFor(() => expect(result.current.record).toEqual(record))
    expect(result.current.active).toBe(true)
  })

  it('reflects active=false for an expired stored record', async () => {
    const record = makeRecord({ registered: true, expiresAt: Date.now() - 1 })
    mockLoadSessionKey.mockResolvedValue(record)

    const { result } = renderHook(() => useSessionKey())

    await waitFor(() => expect(result.current.record).toEqual(record))
    expect(result.current.active).toBe(false)
  })

  it('issue() succeeds in demo mode and signs the public key hash', async () => {
    mockConfig.demoMode = true
    const generated = makeRecord({ registered: false })
    mockGenerateSessionKey.mockResolvedValue(generated)
    mockSignPayload.mockResolvedValue({ signature: new Uint8Array(64) })

    const { result } = renderHook(() => useSessionKey())
    await waitFor(() => expect(result.current.record).toBeNull())

    await act(async () => {
      await result.current.issue()
    })

    expect(mockSignPayload).toHaveBeenCalledTimes(1)
    expect(mockIssueSessionKeyApi).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()
    expect(result.current.record).toEqual({ ...generated, registered: true })
    expect(result.current.active).toBe(true)
    expect(result.current.issuing).toBe(false)
  })

  it('issue() succeeds in live mode and calls the backend + relay flow', async () => {
    mockConfig.demoMode = false
    const generated = makeRecord({ registered: false })
    mockGenerateSessionKey.mockResolvedValue(generated)
    mockIssueSessionKeyApi.mockResolvedValue({ xdr: 'unsigned-xdr' })
    mockSignPreparedXdr.mockResolvedValue('signed-xdr')
    mockConfirmSessionKey.mockResolvedValue({ hash: 'tx-hash' })

    const { result } = renderHook(() => useSessionKey())
    await waitFor(() => expect(result.current.record).toBeNull())

    await act(async () => {
      await result.current.issue()
    })

    expect(mockIssueSessionKeyApi).toHaveBeenCalled()
    expect(mockSignPreparedXdr).toHaveBeenCalled()
    expect(mockConfirmSessionKey).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
    expect(result.current.active).toBe(true)
  })

  it('issue() sets error and rethrows on failure', async () => {
    const boom = new Error('issue failed')
    mockGenerateSessionKey.mockRejectedValue(boom)

    const { result } = renderHook(() => useSessionKey())
    await waitFor(() => expect(result.current.record).toBeNull())

    await act(async () => {
      await expect(result.current.issue()).rejects.toThrow('issue failed')
    })

    expect(result.current.error).toBe('issue failed')
    expect(result.current.issuing).toBe(false)
  })

  it('revoke() clears the record', async () => {
    const record = makeRecord({ registered: true, expiresAt: Date.now() + 60_000 })
    mockLoadSessionKey.mockResolvedValue(record)
    mockClearSessionKey.mockResolvedValue(undefined)

    const { result } = renderHook(() => useSessionKey())
    await waitFor(() => expect(result.current.record).toEqual(record))

    await act(async () => {
      await result.current.revoke()
    })

    expect(mockClearSessionKey).toHaveBeenCalled()
    expect(result.current.record).toBeNull()
    expect(result.current.active).toBe(false)
  })

  it('signerFor returns a signer only when the record covers the amount', async () => {
    const record = makeRecord({ registered: true, expiresAt: Date.now() + 60_000 })
    mockLoadSessionKey.mockResolvedValue(record)

    const { result } = renderHook(() => useSessionKey())
    await waitFor(() => expect(result.current.record).toEqual(record))

    mockSessionKeyCovers.mockReturnValue(true)
    const signer = result.current.signerFor(10)
    expect(signer).not.toBeNull()
    expect(mockSessionKeyCovers).toHaveBeenCalledWith(record, 10)

    mockSessionKeyCovers.mockReturnValue(false)
    expect(result.current.signerFor(999_999)).toBeNull()
  })

  it('signerFor returns null when there is no active record', async () => {
    mockLoadSessionKey.mockResolvedValue(null)
    mockSessionKeyCovers.mockReturnValue(false)

    const { result } = renderHook(() => useSessionKey())
    await waitFor(() => expect(result.current.record).toBeNull())

    expect(result.current.signerFor(10)).toBeNull()
  })

  it('reports supported based on Ed25519 session-key capability', async () => {
    mockSupportsEd25519SessionKeys.mockReturnValue(false)
    const { result } = renderHook(() => useSessionKey())
    await waitFor(() => expect(result.current.record).toBeNull())
    expect(result.current.supported).toBe(false)
  })
})
