import { xdr } from '@stellar/stellar-sdk'

/**
 * ScVal encoders for the RemitPulse account contract's `__check_auth` signature
 * argument. These mirror the contract types:
 *
 * ```rust
 * #[contracttype]
 * pub enum Signature {
 *     WebAuthn(WebAuthnSignature),
 *     Ed25519(Ed25519Signature),
 * }
 *
 * #[contracttype]
 * pub struct WebAuthnSignature {
 *     pub authenticator_data: Bytes,
 *     pub client_data_json: Bytes,
 *     pub id: Bytes,               // credential id
 *     pub signature: BytesN<64>,   // raw low-S r || s
 * }
 *
 * #[contracttype]
 * pub struct Ed25519Signature {
 *     pub public_key: BytesN<32>,
 *     pub signature: BytesN<64>,
 * }
 * ```
 *
 * `#[contracttype]` structs encode as an ScMap whose Symbol keys are sorted;
 * tuple enum variants encode as `Vec[Symbol(variant), value]`. If the compiled
 * contract changes these types, this file is the only place to update.
 */

function struct(fields: Record<string, xdr.ScVal>): xdr.ScVal {
  return xdr.ScVal.scvMap(
    Object.keys(fields)
      .sort()
      .map((key) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val: fields[key]! })),
  )
}

function variant(name: string, value: xdr.ScVal): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(name), value])
}

const bytes = (b: Uint8Array) => xdr.ScVal.scvBytes(b)

export interface WebAuthnSignatureParts {
  authenticatorData: Uint8Array
  clientDataJSON: Uint8Array
  credentialId: Uint8Array
  /** 64-byte compact low-S signature. */
  signature: Uint8Array
}

export function webAuthnSignatureScVal(parts: WebAuthnSignatureParts): xdr.ScVal {
  if (parts.signature.length !== 64) throw new Error('WebAuthn signature must be 64 bytes (r || s)')
  return variant(
    'WebAuthn',
    struct({
      authenticator_data: bytes(parts.authenticatorData),
      client_data_json: bytes(parts.clientDataJSON),
      id: bytes(parts.credentialId),
      signature: bytes(parts.signature),
    }),
  )
}

export function ed25519SignatureScVal(publicKey: Uint8Array, signature: Uint8Array): xdr.ScVal {
  if (publicKey.length !== 32) throw new Error('Ed25519 public key must be 32 bytes')
  if (signature.length !== 64) throw new Error('Ed25519 signature must be 64 bytes')
  return variant('Ed25519', struct({ public_key: bytes(publicKey), signature: bytes(signature) }))
}
