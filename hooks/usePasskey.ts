'use client'

import { useCallback, useState } from 'react'
import { WebAuthnError, browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser'
import type { xdr } from '@stellar/stellar-sdk'
import { useAuth } from '@/components/providers/AuthProvider'
import { api } from '@/lib/api/client'
import { config } from '@/lib/config'
import { webAuthnSignatureScVal } from '@/lib/stellar/signatures'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToHex,
  derToCompactLowS,
  extractP256PublicKey,
  verifyClientData,
} from '@/lib/stellar/webauthn'

export type PasskeyStatus = 'idle' | 'prompting' | 'verifying' | 'error'

/** Validates a Soroban auth payload before it is used as a WebAuthn challenge. */
export function assertSignablePayload(payload: Uint8Array): void {
  if (payload.length !== 32) throw new Error('Soroban auth payload must be 32 bytes')
}

export interface PasskeyAssertion {
  credentialId: Uint8Array
  authenticatorData: Uint8Array
  clientDataJSON: Uint8Array
  /** 64-byte compact low-S r || s, converted from the authenticator's DER output. */
  signature: Uint8Array
  /** Ready-to-use `Signature::WebAuthn` ScVal for the account contract. */
  scVal: xdr.ScVal
}

/** Maps WebAuthn failures to copy that matches the Figma recovery states. */
export function describePasskeyError(err: unknown): string {
  const key =
    err instanceof WebAuthnError && err.code !== 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY'
      ? err.code
      : err instanceof Error
        ? err.name
        : ''
  switch (key) {
    case 'NotAllowedError':
    case 'ERROR_CEREMONY_ABORTED':
      return 'The passkey prompt was closed or timed out. Try again when you’re ready.'
    case 'InvalidStateError':
    case 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED':
      return 'This device already has a RemitPulse passkey. Log in instead.'
    case 'SecurityError':
    case 'ERROR_INVALID_RP_ID':
      return 'Passkeys aren’t available on this address. Make sure you’re on the secure RemitPulse site.'
    case 'NotSupportedError':
      return 'This browser doesn’t support passkeys. Try Safari, Chrome, or Edge on a recent device.'
    default:
      return err instanceof Error ? err.message : 'We couldn’t verify your passkey.'
  }
}

/**
 * Passkey registration, login and Soroban payload signing.
 *
 * WebAuthn assertions return ES256 signatures DER-encoded; the account
 * contract verifies with Soroban's `secp256r1_verify`, which takes a 64-byte
 * `r || s` with low-S. `signPayload` performs that conversion.
 */
export function usePasskey() {
  const { session, signIn } = useAuth()
  const [status, setStatus] = useState<PasskeyStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setError(null)
    setStatus('prompting')
    try {
      const result = await fn()
      setStatus('idle')
      return result
    } catch (err) {
      setError(describePasskeyError(err))
      setStatus('error')
      throw err
    }
  }, [])

  /** 1-click signup: create passkey → backend deploys the smart account for its P-256 key. */
  const register = useCallback(
    (displayName: string) =>
      run(async () => {
        if (!browserSupportsWebAuthn()) throw Object.assign(new Error(), { name: 'NotSupportedError' })
        localStorage.setItem('rp-display-name', displayName)
        const { options } = await api.registerOptions(displayName)
        const response = await startRegistration({
          optionsJSON: {
            ...options,
            rp: { ...options.rp, id: options.rp.id ?? config.webauthn.rpId },
            // Soroban only verifies secp256r1, so ES256 is the only acceptable algorithm.
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          },
        })
        setStatus('verifying')
        const publicKey = extractP256PublicKey(response.response)
        const s = await api.registerVerify({ response, publicKeyHex: bytesToHex(publicKey) })
        signIn(s)
        return s
      }),
    [run, signIn],
  )

  /** Discoverable-credential login; the backend maps the credential to its smart account. */
  const login = useCallback(
    () =>
      run(async () => {
        if (!browserSupportsWebAuthn()) throw Object.assign(new Error(), { name: 'NotSupportedError' })
        const { options } = await api.loginOptions()
        const response = await startAuthentication({ optionsJSON: { ...options, rpId: options.rpId ?? config.webauthn.rpId } })
        setStatus('verifying')
        const s = await api.loginVerify({ response })
        signIn(s)
        return s
      }),
    [run, signIn],
  )

  /**
   * Signs a 32-byte Soroban authorization payload with the user's passkey.
   * The payload is used verbatim as the WebAuthn challenge, so the contract can
   * check `client_data_json.challenge == base64url(signature_payload)`.
   */
  const signPayload = useCallback(
    (payload: Uint8Array): Promise<PasskeyAssertion> =>
      run(async () => {
        if (!session) throw new Error('Log in with your passkey first.')
        assertSignablePayload(payload)

        const response = await startAuthentication({
          optionsJSON: {
            challenge: bytesToBase64Url(payload),
            rpId: config.webauthn.rpId,
            allowCredentials: [{ id: session.credentialId, type: 'public-key' }],
            userVerification: 'required',
            timeout: 60_000,
          },
        })
        setStatus('verifying')

        verifyClientData(response.response.clientDataJSON, { challenge: payload, type: 'webauthn.get' })

        // DER SEQUENCE{r, s} → 64-byte r||s, with s folded into the low half of n.
        const signature = derToCompactLowS(base64UrlToBytes(response.response.signature))
        const parts = {
          credentialId: base64UrlToBytes(response.id),
          authenticatorData: base64UrlToBytes(response.response.authenticatorData),
          clientDataJSON: base64UrlToBytes(response.response.clientDataJSON),
          signature,
        }
        return { ...parts, scVal: webAuthnSignatureScVal(parts) }
      }),
    [run, session],
  )

  /** `AuthSigner` adapter for `lib/stellar/smartAccount`. */
  const signer = useCallback(async (payload: Uint8Array) => (await signPayload(payload)).scVal, [signPayload])

  return {
    status,
    error,
    isBusy: status === 'prompting' || status === 'verifying',
    clearError: () => {
      setError(null)
      setStatus('idle')
    },
    register,
    login,
    signPayload,
    signer,
  }
}
