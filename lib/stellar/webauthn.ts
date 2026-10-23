/**
 * WebAuthn ⇄ Soroban encoding helpers.
 *
 * Passkeys sign with ES256 (ECDSA P-256 / SHA-256) and return the signature
 * ASN.1 DER-encoded. Soroban's `secp256r1_verify` host function — and therefore
 * the RemitPulse account contract's `__check_auth` — expects a fixed 64-byte
 * `r || s` with `s` normalised to the lower half of the curve order.
 */

/** secp256r1 (P-256) group order n. */
export const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n
const P256_HALF_N = P256_N >> 1n

// ─── base64url ──────────────────────────────────────────────────────────────

export function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  return bytes.length ? BigInt('0x' + bytesToHex(bytes)) : 0n
}

function bigIntTo32Bytes(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, '0')
  if (hex.length > 64) throw new Error('Integer does not fit in 32 bytes')
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

// ─── DER → raw r||s ─────────────────────────────────────────────────────────

/** Reads a DER length field, supporting short and long form. */
function readDerLength(der: Uint8Array, offset: number): { length: number; next: number } {
  const first = der[offset]
  if (first === undefined) throw new Error('Truncated DER signature')
  if (first < 0x80) return { length: first, next: offset + 1 }
  const numBytes = first & 0x7f
  if (numBytes === 0 || numBytes > 2) throw new Error('Unsupported DER length encoding')
  let length = 0
  for (let i = 0; i < numBytes; i++) {
    const b = der[offset + 1 + i]
    if (b === undefined) throw new Error('Truncated DER signature')
    length = (length << 8) | b
  }
  return { length, next: offset + 1 + numBytes }
}

function readDerInteger(der: Uint8Array, offset: number): { value: Uint8Array; next: number } {
  if (der[offset] !== 0x02) throw new Error('Expected DER INTEGER')
  const { length, next } = readDerLength(der, offset + 1)
  if (length === 0 || next + length > der.length) throw new Error('Invalid DER INTEGER length')
  return { value: der.slice(next, next + length), next: next + length }
}

/**
 * Converts an ASN.1 DER ECDSA signature
 *   SEQUENCE { INTEGER r, INTEGER s }
 * into the 64-byte compact `r || s` form, normalising `s` to low-S
 * (s ≤ n/2) as required by Soroban's secp256r1 verifier.
 */
export function derToCompactLowS(der: Uint8Array): Uint8Array {
  if (der[0] !== 0x30) throw new Error('Expected DER SEQUENCE')
  const seq = readDerLength(der, 1)
  if (seq.next + seq.length !== der.length) throw new Error('DER SEQUENCE length mismatch')

  const r = readDerInteger(der, seq.next)
  const s = readDerInteger(der, r.next)
  if (s.next !== der.length) throw new Error('Trailing bytes after DER signature')

  const rInt = bytesToBigInt(r.value)
  let sInt = bytesToBigInt(s.value)
  if (rInt === 0n || rInt >= P256_N || sInt === 0n || sInt >= P256_N) {
    throw new Error('Signature component out of range')
  }
  if (sInt > P256_HALF_N) sInt = P256_N - sInt

  const out = new Uint8Array(64)
  out.set(bigIntTo32Bytes(rInt), 0)
  out.set(bigIntTo32Bytes(sInt), 32)
  return out
}

/** Convenience wrapper for the base64url signature field of an assertion response. */
export function assertionSignatureToCompact(signatureB64Url: string): Uint8Array {
  return derToCompactLowS(base64UrlToBytes(signatureB64Url))
}

// ─── Public key extraction ──────────────────────────────────────────────────

/**
 * Returns the 65-byte uncompressed SEC1 P-256 key (0x04 || X || Y) that the
 * account contract stores as its signer.
 *
 * Prefers the SPKI `publicKey` exposed by `getPublicKey()`; falls back to
 * scanning the COSE_Key inside authenticatorData for the -2 (x) / -3 (y) entries.
 */
export function extractP256PublicKey(response: {
  publicKey?: string
  authenticatorData?: string
  attestationObject?: string
}): Uint8Array {
  if (response.publicKey) {
    const spki = base64UrlToBytes(response.publicKey)
    // ES256 SPKI is 91 bytes, ending in the 65-byte uncompressed point.
    const point = spki.slice(spki.length - 65)
    if (point[0] === 0x04) return point
  }

  const source = response.authenticatorData ?? response.attestationObject
  if (!source) throw new Error('Registration response does not include a public key')
  const bytes = base64UrlToBytes(source)
  const x = findCoseCoordinate(bytes, 0x21) // key -2, bstr(32)
  const y = findCoseCoordinate(bytes, 0x22) // key -3, bstr(32)
  if (!x || !y) throw new Error('Could not locate an ES256 public key in the authenticator data')
  const out = new Uint8Array(65)
  out[0] = 0x04
  out.set(x, 1)
  out.set(y, 33)
  return out
}

function findCoseCoordinate(bytes: Uint8Array, label: number): Uint8Array | null {
  for (let i = 0; i < bytes.length - 34; i++) {
    if (bytes[i] === label && bytes[i + 1] === 0x58 && bytes[i + 2] === 0x20) {
      return bytes.slice(i + 3, i + 35)
    }
  }
  return null
}

// ─── Client data ────────────────────────────────────────────────────────────

/** Decodes clientDataJSON and checks it matches the expected challenge + type. */
export function verifyClientData(
  clientDataJSONB64Url: string,
  expected: { challenge: Uint8Array; type: 'webauthn.get' | 'webauthn.create' },
) {
  const json = JSON.parse(new TextDecoder().decode(base64UrlToBytes(clientDataJSONB64Url))) as {
    type: string
    challenge: string
    origin: string
  }
  if (json.type !== expected.type) throw new Error(`Unexpected clientData type: ${json.type}`)
  if (json.challenge !== bytesToBase64Url(expected.challenge)) {
    throw new Error('Passkey signed a different challenge than the transaction payload')
  }
  return json
}
