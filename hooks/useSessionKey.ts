'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
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
import { sessionKeyStore } from '@/lib/stellar/sessionKeyStore'
import { ed25519SignatureScVal } from '@/lib/stellar/signatures'
import { AUTH_TTL_LEDGERS, signPreparedXdr, type AuthSigner } from '@/lib/stellar/smartAccount'
import { bytesToHex } from '@/lib/stellar/webauthn'
import { usePasskey } from './usePasskey'

/**
 * Pure helpers backing `useSessionKey`. Extracted so the lifecycle logic can be
 * unit-tested without a React renderer.
 */

/** Loads the persisted session key for a contract, or null when absent/unreadable. */
export async function loadSessionKeyRecord(contractId: string): Promise<SessionKeyRecord | null> {
  try {
    return await loadSessionKey(contractId)
  } catch {
    return null
  }
}

export interface IssueSessionKeyDeps {
  contractId: string
  passkey: { signPayload: (payload: Uint8Array) => Promise<unknown>; signer: AuthSigner }
  demoMode: boolean
  maxAmount: number
  ttlMinutes: number
  issueSessionKey: typeof api.issueSessionKey
  confirmSessionKey: typeof api.confirmSessionKey
  signPreparedXdr: typeof signPreparedXdr
  isCurrent?: () => boolean
}

/**
 * Generates a session key and registers it (demo: passkey ceremony over the
 * key hash; live: `add_signer` auth entry signed with the passkey). Returns the
 * registered record.
 */
export async function issueSessionKey(deps: IssueSessionKeyDeps): Promise<SessionKeyRecord> {
  const rec = await generateSessionKey({
    contractId: deps.contractId,
    maxAmount: deps.maxAmount,
    ttlMinutes: deps.ttlMinutes,
  })
  if (deps.demoMode) {
    // No chain in demo mode: still run the real passkey ceremony over a payload binding the key.
    await deps.passkey.signPayload(hash(rec.publicKey))
  } else {
    const { xdr } = await deps.issueSessionKey({
      contractId: deps.contractId,
      publicKeyHex: bytesToHex(rec.publicKey),
      maxAmount: rec.maxAmount,
      ttlMinutes: deps.ttlMinutes,
    })
    const signedXdr = await deps.signPreparedXdr({
      xdr,
      accountId: deps.contractId,
      signer: deps.passkey.signer,
      ttlLedgers: AUTH_TTL_LEDGERS.immediate,
    })
    await deps.confirmSessionKey({ contractId: deps.contractId, signedXdr })
  }
  if (deps.isCurrent && !deps.isCurrent())
    throw new Error('Session changed while enabling quick send.')
  const registered = { ...rec, registered: true }
  await saveSessionKey(registered)
  return registered
}

/** Returns a session-key signer when the record can cover `amount`, otherwise null. */
export function sessionSignerFor(
  record: SessionKeyRecord | null,
  amount: number,
): AuthSigner | null {
  if (!sessionKeyCovers(record, amount)) return null
  return async (payload) => {
    if (!sessionKeyCovers(record, amount))
      throw new Error('Session key no longer covers this transfer')
    return ed25519SignatureScVal(record!.publicKey, await signWithSessionKey(record!, payload))
  }
}

/** True when the record is registered and not yet expired. */
export function isSessionKeyActive(record: SessionKeyRecord | null): boolean {
  return !!record?.registered && record.expiresAt > Date.now()
}

/**
 * Ed25519 session key lifecycle. Issuing one costs a single passkey prompt
 * (authorising `add_signer` with a spend cap + expiry); afterwards transfers
 * up to the cap sign silently until the key expires.
 */
export function useSessionKey() {
  const { session } = useAuth()
  const passkey = usePasskey()
  const stored = useSyncExternalStore(
    sessionKeyStore.subscribe,
    sessionKeyStore.getSnapshot,
    sessionKeyStore.getServerSnapshot,
  )
  const contractId = session?.contractId ?? null
  const record = stored?.contractId === contractId ? stored : null
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    if (!contractId) return
    let cancelled = false
    const version = sessionKeyStore.getVersion()
    loadSessionKeyRecord(contractId).then((loaded) => {
      if (!cancelled && sessionKeyStore.getVersion() === version) {
        sessionKeyStore.set(loaded)
        setNow(Date.now())
      }
    })
    return () => {
      cancelled = true
    }
  }, [contractId])

  useEffect(() => {
    if (!record) return
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [record])

  const issue = useCallback(async () => {
    if (!session) throw new Error('Log in first.')
    setIssuing(true)
    setError(null)
    const version = sessionKeyStore.getVersion()
    try {
      const registered = await issueSessionKey({
        contractId: session.contractId,
        passkey,
        demoMode: config.demoMode,
        maxAmount: config.sessionKey.maxAmount,
        ttlMinutes: config.sessionKey.ttlMinutes,
        issueSessionKey: api.issueSessionKey,
        confirmSessionKey: api.confirmSessionKey,
        signPreparedXdr,
        isCurrent: () => sessionKeyStore.getVersion() === version,
      })
      setNow(Date.now())
      return registered
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable quick send.')
      throw err
    } finally {
      setIssuing(false)
    }
  }, [session, passkey])

  const revoke = useCallback(async () => {
    setError(null)
    sessionKeyStore.set(null)
    try {
      await clearSessionKey()
    } catch (err) {
      setError(
        'Could not delete the stored key. Quick send is disabled in this tab; retry removal before reloading.',
      )
      throw err
    }
  }, [])

  /** Returns a session-key signer when it can cover `amount`, otherwise null. */
  const signerFor = useCallback(
    (amount: number): AuthSigner | null => {
      const current = sessionKeyStore.getSnapshot()
      if (!current || current.contractId !== contractId) return null
      const signer = sessionSignerFor(current, amount)
      if (!signer) return null
      return async (payload) => {
        if (sessionKeyStore.getSnapshot() !== current)
          throw new Error('Quick send was disabled or changed')
        return signer(payload)
      }
    },
    [contractId],
  )

  /** The timer refreshes the displayed TTL; signing rechecks the actual expiry. */
  const minutesLeft = record
    ? Math.max(0, Math.ceil((record.expiresAt - (now ?? record.expiresAt)) / 60_000))
    : null

  return {
    supported: typeof window !== 'undefined' && supportsEd25519SessionKeys(),
    record,
    active: isSessionKeyActive(record),
    minutesLeft,
    issuing,
    error,
    issue,
    revoke,
    signerFor,
  }
}
