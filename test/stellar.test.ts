import { xdr } from '@stellar/stellar-sdk'
import { describe, expect, it } from 'vitest'
import { fromBaseUnits, toBaseUnits } from '@/lib/stellar/assets'
import { ed25519SignatureScVal, webAuthnSignatureScVal } from '@/lib/stellar/signatures'

describe('amount conversion', () => {
  it('round-trips 7-decimal base units without float error', () => {
    expect(toBaseUnits('500.00')).toBe(5_000_000_000n)
    expect(toBaseUnits('0.1')).toBe(1_000_000n)
    expect(toBaseUnits('1.23456789')).toBe(12_345_678n)
    expect(fromBaseUnits(5_000_000_000n)).toBe('500')
    expect(fromBaseUnits(12_345_678n)).toBe('1.2345678')
  })
  it('rejects garbage', () => {
    expect(() => toBaseUnits('1e5')).toThrow()
    expect(() => toBaseUnits('-1')).toThrow()
  })
})

describe('signature ScVals', () => {
  it('encodes Signature::WebAuthn as Vec[Symbol, Map] with sorted keys', () => {
    const v = webAuthnSignatureScVal({
      authenticatorData: new Uint8Array(37),
      clientDataJSON: new TextEncoder().encode('{}'),
      credentialId: new Uint8Array([1, 2, 3]),
      signature: new Uint8Array(64),
    })
    const roundTrip = xdr.ScVal.fromXdr(v.toXdr('base64'), 'base64')
    expect(roundTrip.toXdr('base64')).toBe(v.toXdr('base64'))
    expect(v.type).toBe('scvVec')
  })
  it('validates lengths', () => {
    expect(() => ed25519SignatureScVal(new Uint8Array(31), new Uint8Array(64))).toThrow()
    expect(() =>
      webAuthnSignatureScVal({ authenticatorData: new Uint8Array(), clientDataJSON: new Uint8Array(), credentialId: new Uint8Array(), signature: new Uint8Array(70) }),
    ).toThrow()
  })
})
