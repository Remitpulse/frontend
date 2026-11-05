import { describe, expect, it } from 'vitest'
import { bytesToBase64Url, verifyClientData } from '@/lib/stellar/webauthn'

const expected = {
  challenge: new Uint8Array(32).fill(7),
  type: 'webauthn.get' as const,
  origin: 'https://remitpulse.example',
}
function data(patch: object = {}) {
  return bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ ...expected, challenge: bytesToBase64Url(expected.challenge), ...patch }),
    ),
  )
}
describe('signing client data', () => {
  it('accepts the expected origin, type and exact challenge', () => {
    expect(() => verifyClientData(data(), expected)).not.toThrow()
  })
  it.each([
    { origin: 'https://attacker.example' },
    { challenge: 'different' },
    { type: 'webauthn.create' },
    { crossOrigin: true },
  ])('rejects mismatched signing context %j', (patch) => {
    expect(() => verifyClientData(data(patch), expected)).toThrow()
  })
})
