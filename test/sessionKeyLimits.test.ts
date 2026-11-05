import { describe, expect, it } from 'vitest'
import {
  generateSessionKey,
  sessionKeyCovers,
  signWithSessionKey,
  verifyWithSessionKey,
  type SessionKeyRecord,
} from '@/lib/stellar/sessionKeys'

function record(overrides: Partial<SessionKeyRecord> = {}): SessionKeyRecord {
  return {
    id: 'active',
    contractId: 'test',
    privateKey: {} as CryptoKey,
    publicKey: new Uint8Array(32),
    registered: true,
    maxAmount: 50,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  }
}

describe('session-key limits and real WebCrypto (no network)', () => {
  it.each([0, -1, NaN, Infinity, 50.01])('rejects out-of-scope amount %s', (amount) => {
    expect(sessionKeyCovers(record(), amount)).toBe(false)
  })
  it('rejects expired, unregistered and invalid-scope keys', () => {
    expect(sessionKeyCovers(record({ expiresAt: Date.now() - 1 }), 10)).toBe(false)
    expect(sessionKeyCovers(record({ registered: false }), 10)).toBe(false)
    expect(sessionKeyCovers(record({ maxAmount: Infinity }), 10)).toBe(false)
    expect(sessionKeyCovers(record(), 50)).toBe(true)
  })
  it('generates non-extractable keys and detects a tampered payload', async () => {
    const key = await generateSessionKey({ contractId: 'test', maxAmount: 50, ttlMinutes: 30 })
    expect(key.privateKey.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('pkcs8', key.privateKey)).rejects.toThrow()
    const payload = new Uint8Array(32).fill(1)
    const signature = await signWithSessionKey(key, payload)
    expect(await verifyWithSessionKey(key, payload, signature)).toBe(true)
    expect(await verifyWithSessionKey(key, new Uint8Array(32).fill(2), signature)).toBe(false)
  })
  it.each([
    { maxAmount: -1, ttlMinutes: 30 },
    { maxAmount: 50, ttlMinutes: NaN },
  ])('rejects invalid issuance configuration', async (scope) => {
    await expect(generateSessionKey({ contractId: 'test', ...scope })).rejects.toThrow(
      'positive finite',
    )
  })
})
