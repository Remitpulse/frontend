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
    (amount: string) => !!sessionKey.signerFor(Number(amount)),
    [sessionKey],
  )

  const send = useCallback(
    async (input: { quote: Quote; recipient: Recipient; saveRecipient: boolean; funding: FundingSource }) => {
      if (!session) throw new Error('Log in with your passkey first.')
      const { quote } = input
      setError(null)
      setPhase('authorizing')
      try {
        const sessionSigner = sessionKey.signerFor(Number(quote.sendAmount))
        const signer: AuthSigner = sessionSigner ?? passkey.signer

        let signedXdr: string
        if (config.demoMode) {
          // Demo mode has no deployed contracts; sign a payload bound to the quote so the
          // real passkey ceremony and DER → r||s conversion still run end to end.
          const scVal = await signer(hash(new TextEncoder().encode(quote.id)))
          signedXdr = scVal.toXdr('base64')
        } else {
          signedXdr = await buildTokenTransfer({
            accountId: session.contractId,
            tokenContractId: assetContractId(quote.sendAsset),
            to: quote.payTo,
            amount: toBaseUnits(quote.sendAmount),
            signer,
            ttlLedgers: input.funding === 'partner' ? AUTH_TTL_LEDGERS.deferred : AUTH_TTL_LEDGERS.immediate,
          })
        }

        setPhase('submitting')
        const res: CreateTransferResponse = await api.createTransfer({
          quoteId: quote.id,
          recipient: input.recipient,
          saveRecipient: input.saveRecipient,
          funding: input.funding,
          signedXdr,
          signer: sessionSigner ? 'session' : 'passkey',
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
