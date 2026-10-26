'use client'

import { useCallback, useEffect, useState } from 'react'
import { hash } from '@stellar/stellar-sdk'
import { useAuth } from '@/components/providers/AuthProvider'
import { api } from '@/lib/api/client'
import { config } from '@/lib/config'
import {
  clearSessionKey,
  generateSessionKey,
  loadSessionKey,
  saveSessionKey,
  sessionKeyCovers,
  signWithSessionKey,
  supportsEd25519SessionKeys,
  type SessionKeyRecord,
} from '@/lib/stellar/sessionKeys'
import { ed25519SignatureScVal } from '@/lib/stellar/signatures'
import { AUTH_TTL_LEDGERS, signPreparedXdr, type AuthSigner } from '@/lib/stellar/smartAccount'
import { bytesToHex } from '@/lib/stellar/webauthn'
import { usePasskey } from './usePasskey'

/**
 * Ed25519 session key lifecycle. Issuing one costs a single passkey prompt
 * (authorising `add_signer` with a spend cap + expiry); afterwards transfers
 * up to the cap sign silently until the key expires.
 */
export function useSessionKey() {
  const { session } = useAuth()
  const passkey = usePasskey()
  const [record, setRecord] = useState<SessionKeyRecord | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    if (!session) {
      setRecord(null)
      return
    }
    loadSessionKey(session.contractId).then(setRecord, () => setRecord(null))
  }, [session])

  useEffect(() => {
    if (!record) return
    const tick = () => setNow(Date.now())
    tick()
    const i = setInterval(tick, 30_000)
    return () => clearInterval(i)
  }, [record])

  const issue = useCallback(async () => {
    if (!session) throw new Error('Log in first.')
    setIssuing(true)
    setError(null)
    try {
      const rec = await generateSessionKey({
        contractId: session.contractId,
        maxAmount: config.sessionKey.maxAmount,
        ttlMinutes: config.sessionKey.ttlMinutes,
      })
      if (config.demoMode) {
        // No chain in demo mode: still run the real passkey ceremony over a payload binding the key.
        await passkey.signPayload(hash(rec.publicKey))
      } else {
        const { xdr } = await api.issueSessionKey({
          contractId: session.contractId,
          publicKeyHex: bytesToHex(rec.publicKey),
          maxAmount: rec.maxAmount,
          ttlMinutes: config.sessionKey.ttlMinutes,
        })
        const signedXdr = await signPreparedXdr({
          xdr,
          accountId: session.contractId,
          signer: passkey.signer,
          ttlLedgers: AUTH_TTL_LEDGERS.immediate,
        })
        await api.confirmSessionKey({ contractId: session.contractId, signedXdr })
      }
      const registered = { ...rec, registered: true }
      await saveSessionKey(registered)
      setRecord(registered)
      return registered
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable quick send.')
      throw err
    } finally {
      setIssuing(false)
    }
  }, [session, passkey])

  const revoke = useCallback(async () => {
    await clearSessionKey()
    setRecord(null)
  }, [])

  /** Returns a session-key signer when it can cover `amount`, otherwise null. */
  const signerFor = useCallback(
    (amount: number): AuthSigner | null => {
      if (!sessionKeyCovers(record, amount)) return null
      return async (payload) => ed25519SignatureScVal(record.publicKey, await signWithSessionKey(record, payload))
    },
    [record],
  )

  return {
    supported: typeof window !== 'undefined' && supportsEd25519SessionKeys(),
    record,
    active: !!record?.registered && now !== null && record.expiresAt > now,
    minutesLeft: record && now !== null ? Math.max(0, Math.round((record.expiresAt - now) / 60_000)) : 0,
    issuing,
    error,
    issue,
    revoke,
    signerFor,
  }
}
