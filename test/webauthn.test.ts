import { generateKeyPairSync, sign, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  P256_N,
  bytesToBase64Url,
  bytesToHex,
  derToCompactLowS,
  extractP256PublicKey,
} from '@/lib/stellar/webauthn'

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const HALF_N = P256_N >> 1n

function toBigInt(b: Uint8Array) {
  return BigInt('0x' + bytesToHex(b))
}

function encodeDerInt(v: bigint) {
  let hex = v.toString(16)
  if (hex.length % 2) hex = '0' + hex
  let bytes = Buffer.from(hex, 'hex')
  if (bytes[0]! & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes])
  return Buffer.concat([Buffer.from([0x02, bytes.length]), bytes])
}

function encodeDer(r: bigint, s: bigint) {
  const body = Buffer.concat([encodeDerInt(r), encodeDerInt(s)])
  return new Uint8Array(Buffer.concat([Buffer.from([0x30, body.length]), body]))
}

describe('derToCompactLowS', () => {
  it('produces a 64-byte r||s that verifies with the original key', () => {
    for (let i = 0; i < 50; i++) {
      const msg = Buffer.from(`soroban payload ${i}`)
      const der = sign('sha256', msg, { key: privateKey, dsaEncoding: 'der' })
      const compact = derToCompactLowS(new Uint8Array(der))
      expect(compact).toHaveLength(64)
      expect(toBigInt(compact.slice(32))).toBeLessThanOrEqual(HALF_N)
      expect(verify('sha256', msg, { key: publicKey, dsaEncoding: 'ieee-p1363' }, compact)).toBe(
        true,
      )
    }
  })

  it('normalises high-S signatures to low-S', () => {
    const msg = Buffer.from('high-s')
    const p1363 = sign('sha256', msg, { key: privateKey, dsaEncoding: 'ieee-p1363' })
    const r = toBigInt(p1363.subarray(0, 32))
    let s = toBigInt(p1363.subarray(32))
    if (s <= HALF_N) s = P256_N - s // force high-S
    const compact = derToCompactLowS(encodeDer(r, s))
    expect(toBigInt(compact.slice(32))).toBe(P256_N - s)
    expect(verify('sha256', msg, { key: publicKey, dsaEncoding: 'ieee-p1363' }, compact)).toBe(true)
  })

  it('left-pads short integers to 32 bytes', () => {
    const compact = derToCompactLowS(encodeDer(1n, 2n))
    expect(compact[31]).toBe(1)
    expect(compact[63]).toBe(2)
    expect(compact.slice(0, 31).every((b) => b === 0)).toBe(true)
  })

  it('rejects malformed input', () => {
    expect(() => derToCompactLowS(new Uint8Array([0x31, 0x00]))).toThrow('SEQUENCE')
    expect(() => derToCompactLowS(encodeDer(0n, 1n))).toThrow('out of range')
    expect(() => derToCompactLowS(encodeDer(1n, P256_N))).toThrow('out of range')
    const der = encodeDer(5n, 6n)
    expect(() => derToCompactLowS(der.slice(0, -1))).toThrow()
  })
})

describe('extractP256PublicKey', () => {
  const spki = publicKey.export({ format: 'der', type: 'spki' })
  const jwk = publicKey.export({ format: 'jwk' })
  const x = Buffer.from(jwk.x!, 'base64url')
  const y = Buffer.from(jwk.y!, 'base64url')
  const expected = bytesToHex(new Uint8Array(Buffer.concat([Buffer.from([4]), x, y])))

  it('reads the uncompressed point from SPKI', () => {
    expect(
      bytesToHex(extractP256PublicKey({ publicKey: bytesToBase64Url(new Uint8Array(spki)) })),
    ).toBe(expected)
  })

  it('falls back to the COSE key in authenticatorData', () => {
    // rpIdHash(32) | flags | signCount(4) | aaguid(16) | credIdLen(2) | credId | COSE_Key
    const cose = Buffer.concat([
      Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01]),
      Buffer.from([0x21, 0x58, 0x20]),
      x,
      Buffer.from([0x22, 0x58, 0x20]),
      y,
    ])
    const authData = Buffer.concat([
      Buffer.alloc(32),
      Buffer.from([0x45]),
      Buffer.alloc(4),
      Buffer.alloc(16),
      Buffer.from([0, 4]),
      Buffer.from([9, 9, 9, 9]),
      cose,
    ])
    expect(
      bytesToHex(
        extractP256PublicKey({ authenticatorData: bytesToBase64Url(new Uint8Array(authData)) }),
      ),
    ).toBe(expected)
  })
})
