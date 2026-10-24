'use client'

import { useCallback, useState } from 'react'
import { hash } from '@stellar/stellar-sdk'
import { useAuth } from '@/components/providers/AuthProvider'
import { api } from '@/lib/api/client'
import type { CreateTransferResponse, FundingSource, Quote, Recipient } from '@/lib/api/types'
import { config } from '@/lib/config'
import { assetContractId, toBaseUnits } from '@/lib/stellar/assets'
import { AUTH_TTL_LEDGERS, buildTokenTransfer, type AuthSigner } from '@/lib/stellar/smartAccount'
import { describePasskeyError, usePasskey } from './usePasskey'
import { useSessionKey } from './useSessionKey'

/**
 * Pure helpers backing `useSendTransfer`. Kept separate from the hook so the
 * authorisation logic can be unit tested without a React renderer.
 */

/** Whether the transfer amount is within the session key's spending scope. */
export function resolveWillUseSessionKey(
  signerFor: (amount: number) => AuthSigner | null | undefined,
  amount: string,
): boolean {
  return !!signerFor(Number(amount))
}

/** Picks the session signer when the amount is in scope, else the passkey signer. */
export function selectSigner(
  signerFor: (amount: number) => AuthSigner | null | undefined,
  passkeySigner: AuthSigner,
  amount: string,
): { signer: AuthSigner; usedSessionKey: boolean } {
  const sessionSigner = signerFor(Number(amount))
  return { signer: sessionSigner ?? passkeySigner, usedSessionKey: !!sessionSigner }
}

/** TTL for the Soroban auth entry: deferred funding gets the longer window. */
export function authTtlForFunding(funding: FundingSource): number {
  return funding === 'partner' ? AUTH_TTL_LEDGERS.deferred : AUTH_TTL_LEDGERS.immediate
}

/**
 * Demo mode has no deployed contracts; sign a payload bound to the quote so the
 * real passkey ceremony and DER → r||s conversion still run end to end.
 */
export async function signDemoPayload(signer: AuthSigner, quoteId: string): Promise<string> {
  const scVal = await signer(hash(new TextEncoder().encode(quoteId)))
  return scVal.toXdr('base64')
}

export type SendPhase = 'idle' | 'authorizing' | 'submitting' | 'done' | 'error'

/**
 * Authorises the quoted stablecoin transfer from the user's smart account and
 * hands it to the relay. Small amounts use the Ed25519 session key; everything
 * else prompts for the passkey.
 */
export function useSendTransfer() {
  const { session } = useAuth()
  const passkey = usePasskey()
  const sessionKey = useSessionKey()
  const [phase, setPhase] = useState<SendPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  const willUseSessionKey = useCallback(
    (amount: string) => resolveWillUseSessionKey(sessionKey.signerFor, amount),
    [sessionKey],
  )

  const send = useCallback(
    async (input: { quote: Quote; recipient: Recipient; saveRecipient: boolean; funding: FundingSource }) => {
      if (!session) throw new Error('Log in with your passkey first.')
      const { quote } = input
      setError(null)
      setPhase('authorizing')
      try {
        const { signer, usedSessionKey } = selectSigner(
          sessionKey.signerFor,
          passkey.signer,
          quote.sendAmount,
        )

        let signedXdr: string
        if (config.demoMode) {
          signedXdr = await signDemoPayload(signer, quote.id)
        } else {
          signedXdr = await buildTokenTransfer({
            accountId: session.contractId,
            tokenContractId: assetContractId(quote.sendAsset),
            to: quote.payTo,
            amount: toBaseUnits(quote.sendAmount),
            signer,
            ttlLedgers: authTtlForFunding(input.funding),
          })
        }

        setPhase('submitting')
        const res: CreateTransferResponse = await api.createTransfer({
          quoteId: quote.id,
          recipient: input.recipient,
          saveRecipient: input.saveRecipient,
          funding: input.funding,
          signedXdr,
          signer: usedSessionKey ? 'session' : 'passkey',
        })
        setPhase('done')
        return res
      } catch (err) {
        setPhase('error')
        setError(describePasskeyError(err))
        throw err
      }
    },
    [session, sessionKey, passkey],
  )

  return { send, phase, error, willUseSessionKey, isBusy: phase === 'authorizing' || phase === 'submitting' }
}
