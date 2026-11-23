'use client'

import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Wallet } from 'lucide-react'
import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api'
import type { CasinoState } from '@/lib/casino/catalog'
import { parseXlm, STROOPS, xlm } from '@/lib/casino/money'
import type { Result } from './Arcade'

const testnet = 'Test SDF Network ; September 2015'

export function Vault({
  state,
  act,
}: {
  state?: CasinoState
  act: (input: Record<string, unknown>) => Promise<Result>
}) {
  const [missingExtension, setMissingExtension] = useState(false)
  const [wallet, setWallet] = useState('')
  const [walletBalance, setWalletBalance] = useState<Result['walletBalance']>()
  const [amount, setAmount] = useState('1')
  const [direction, setDirection] = useState<'deposit' | 'withdraw'>('deposit')
  const [eligible, setEligible] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hash, setHash] = useState('')
  const [signed, setSigned] = useState<{ envelope: string; hash?: string }>(() => {
    try {
      const saved =
        typeof window === 'undefined' ? null : window.sessionStorage.getItem('rp-testnet-deposit')
      if (!saved) return { envelope: '' }
      // Older clients stored the envelope as a bare XDR string.
      if (!saved.startsWith('{')) return { envelope: saved }
      const { envelope, hash } = JSON.parse(saved)
      return {
        envelope: typeof envelope === 'string' ? envelope : '',
        hash: typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash) ? hash : undefined,
      }
    } catch {
      return { envelope: '' }
    }
  })

  const wrongWallet = !!wallet && !!state?.linkedWallet && wallet !== state.linkedWallet
  const emptyWithdrawal = direction === 'withdraw' && state?.testnet === '0'
  let amountError = ''
  try {
    const stroops = parseXlm(amount)
    if (stroops <= 0n || stroops > 1000n * STROOPS) {
      amountError = 'Enter an amount greater than zero and up to 1,000 XLM.'
    } else if (
      direction === 'withdraw' &&
      !emptyWithdrawal &&
      state &&
      stroops > BigInt(state.testnet)
    ) {
      amountError = 'The amount exceeds your credited Testnet balance.'
    } else if (
      direction === 'deposit' &&
      walletBalance?.funded &&
      stroops >= BigInt(walletBalance.stroops)
    ) {
      amountError =
        'Leave enough XLM in your wallet for the Stellar account reserve and transaction fee.'
    }
  } catch (error) {
    amountError = (error as Error).message
  }
  const pendingTransfer = direction === 'deposit' ? state?.deposit : state?.withdrawal
  const explorerHash =
    hash || (direction === 'deposit' && signed.envelope ? signed.hash : pendingTransfer?.hash)

  async function requireTestnet() {
    const network = await getNetwork()
    if (network.error)
      throw new Error(
        'Freighter could not read the active network. Unlock the extension and try again.',
      )
    if (network.networkPassphrase !== testnet)
      throw new Error('Switch Freighter to Stellar Testnet, then try again.')
  }

  async function refreshWalletBalance(address: string) {
    try {
      const result = await act({ action: 'wallet-balance', wallet: address })
      setWalletBalance(result.walletBalance)
    } catch {
      setWalletBalance(undefined)
    }
  }

  async function connect() {
    setError('')
    setStatus('')
    setMissingExtension(false)
    setWallet('')
    setWalletBalance(undefined)
    setBusy(true)
    try {
      const detection = await isConnected()
      if (!detection.isConnected) {
        setMissingExtension(true)
        throw new Error(
          'Freighter was not detected in this browser. Open this preview in the browser profile where the extension is installed.',
        )
      }
      const access = await requestAccess()
      if (access.error || !access.address)
        throw new Error(
          'Freighter did not share an address. Unlock the extension, then approve this site in the wallet popup.',
        )
      await requireTestnet()
      setWallet(access.address)
      setStatus('Freighter connected on Stellar Testnet.')
      await refreshWalletBalance(access.address)
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function transferAction(retry?: 'deposit' | 'withdraw', retryHash?: string) {
    setError('')
    setHash('')
    setBusy(true)
    try {
      if (!retry) {
        await requireTestnet()
        const active = await getAddress()
        if (active.error || active.address !== wallet) {
          setWallet('')
          setWalletBalance(undefined)
          throw new Error(
            'The active Freighter wallet changed or is locked. Connect it again before continuing.',
          )
        }
      }
      let result: Result
      if (retry === 'withdraw' || (!retry && direction === 'withdraw')) {
        setStatus('Waiting for Stellar Testnet confirmation…')
        result = await act({
          action: retry ? 'withdraw-retry' : 'withdraw',
          hash: retry === 'withdraw' ? state?.withdrawal?.hash : undefined,
          amount,
          wallet,
          eligible,
        })
      } else {
        let envelope = signed.envelope
        if (!retry) {
          setStatus('Preparing native XLM payment…')
          const intent = await act({ action: 'deposit-prepare', amount, wallet, eligible })
          if (!intent.xdr) throw new Error('The server did not return a Testnet payment to sign.')
          setStatus('Approve the Testnet payment in Freighter.')
          const approval = await signTransaction(intent.xdr, {
            networkPassphrase: testnet,
            address: wallet,
          })
          if (approval.error || !approval.signedTxXdr)
            throw new Error('Freighter did not sign the payment.')
          envelope = approval.signedTxXdr
          const deposit = { envelope, hash: intent.hash }
          setSigned(deposit)
          try {
            window.sessionStorage.setItem('rp-testnet-deposit', JSON.stringify(deposit))
          } catch {
            // The current dialog can still submit or retry the signed payment.
          }
        }
        setStatus('Waiting for Stellar Testnet confirmation…')
        const serverHash = retryHash ?? (retry && !envelope ? state?.deposit?.hash : undefined)
        result = await act(
          serverHash
            ? { action: 'deposit-retry', hash: serverHash }
            : { action: 'deposit-submit', xdr: envelope },
        )
        if (!retryHash || retryHash === signed.hash) {
          setSigned({ envelope: '' })
          try {
            window.sessionStorage.removeItem('rp-testnet-deposit')
          } catch {
            // Transfer confirmation is already recorded by the server.
          }
        }
      }
      setStatus(result.message || 'Transfer confirmed.')
      setHash(result.hash || '')
      if (wallet) await refreshWalletBalance(wallet)
    } catch (failure) {
      setStatus('')
      setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="vault">
      <p className="eyebrow">
        <Wallet size={16} /> STELLAR TESTNET
      </p>
      <h2>Wallet</h2>
      <div className="summary-grid">
        <div>
          <span>Demo balance</span>
          <strong>
            {state ? xlm(state.demo) : '–'} <small>XLM</small>
          </strong>
        </div>
        <div>
          <span>Testnet balance</span>
          <strong>
            {state ? xlm(state.testnet) : '–'} <small>XLM</small>
          </strong>
        </div>
      </div>
      <p>Testnet payments use native XLM. Demo wagers use a separate, non-withdrawable balance.</p>
      {wallet ? (
        <div>
          <p className="connected" title={wallet}>
            Stellar Testnet · {wallet.slice(0, 9)}…{wallet.slice(-6)}
          </p>
          {walletBalance?.funded ? (
            <p>On-chain wallet balance: {xlm(walletBalance.stroops)} XLM</p>
          ) : walletBalance ? (
            <p className="notice">
              Fund this wallet with Testnet XLM to activate it before depositing.
            </p>
          ) : (
            <p>On-chain wallet balance unavailable.</p>
          )}
          <button type="button" className="button outlined" onClick={connect} disabled={busy}>
            Refresh wallet connection
          </button>
        </div>
      ) : (
        <button className="button outlined" onClick={connect} disabled={busy}>
          <Wallet size={17} /> Connect Freighter
        </button>
      )}
      {missingExtension && (
        <div className="notice">
          <p>Use a desktop browser with Freighter (now Varial) enabled.</p>
          <button
            className="button outlined"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.origin)
                setStatus('Preview link copied.')
              } catch {
                setStatus('Copy the preview URL from your browser address bar.')
              }
            }}
          >
            Copy preview link
          </button>
          <a
            href="https://github.com/stellar/freighter-developer-docs/blob/main/extension/installation.md"
            target="_blank"
            rel="noreferrer"
          >
            Wallet setup
          </a>
        </div>
      )}
      {!state?.walletEnabled && (
        <p className="notice">Testnet transfers require a configured treasury.</p>
      )}
      <div className="segmented">
        <button
          aria-pressed={direction === 'deposit'}
          onClick={() => setDirection('deposit')}
          disabled={busy}
        >
          <ArrowDownToLine size={16} /> Deposit
        </button>
        <button
          aria-pressed={direction === 'withdraw'}
          onClick={() => setDirection('withdraw')}
          disabled={busy}
        >
          <ArrowUpFromLine size={16} /> Withdraw
        </button>
      </div>
      {wrongWallet && (
        <p className="notice" role="status">
          This session is linked to <code>{state?.linkedWallet}</code>. Select that account in
          Freighter and refresh.
        </p>
      )}
      {emptyWithdrawal && !state?.withdrawal && (
        <p className="notice" role="status">
          A confirmed Testnet deposit is required before withdrawing.
        </p>
      )}
      <label>
        Amount
        <div className="amount-input">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            aria-invalid={!!amountError}
            aria-describedby={amountError ? 'wallet-amount-error' : undefined}
            disabled={busy}
          />
          <span>XLM</span>
        </div>
      </label>
      {amountError && (
        <p id="wallet-amount-error" className="error-text">
          {amountError}
        </p>
      )}
      <label className="check">
        <input type="checkbox" checked={eligible} onChange={(e) => setEligible(e.target.checked)} />{' '}
        I am eligible to participate and am using Testnet XLM.
      </label>
      {direction === 'deposit' && (state?.deposit || signed.envelope) && (
        <button
          className="button outlined"
          disabled={busy}
          onClick={() => transferAction('deposit')}
        >
          {signed.envelope ? 'Resume signed deposit from this browser' : 'Check signed deposit'}
        </button>
      )}
      {direction === 'withdraw' && state?.withdrawal ? (
        <button
          className="button primary"
          disabled={busy}
          onClick={() => transferAction('withdraw')}
        >
          Check pending withdrawal
        </button>
      ) : (
        <button
          className="button primary"
          disabled={
            busy ||
            !eligible ||
            !wallet ||
            !state?.walletEnabled ||
            wrongWallet ||
            emptyWithdrawal ||
            !!amountError
          }
          onClick={() => transferAction()}
        >
          {direction === 'deposit' ? 'Deposit Testnet XLM' : 'Withdraw Testnet XLM'}
        </button>
      )}
      {status && <p role="status">{status}</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {pendingTransfer && !hash && !(direction === 'deposit' && signed.envelope) && (
        <p role="status">
          {direction === 'deposit' ? 'Signed deposit' : 'Reserved withdrawal'} awaiting confirmation
          · {xlm(pendingTransfer.amount)} XLM
        </p>
      )}
      {explorerHash && (
        <a
          href={'https://stellar.expert/explorer/testnet/tx/' + explorerHash}
          target="_blank"
          rel="noreferrer"
        >
          View in Stellar explorer
        </a>
      )}
      {!!state?.transfers?.length && (
        <details className="wallet-transfers">
          <summary>Recent Testnet transfers</summary>
          <ul className="history">
            {state.transfers.map((transfer) => (
              <li key={transfer.hash}>
                <span>
                  <strong>{transfer.direction === 'deposit' ? 'Deposit' : 'Withdrawal'}</strong>
                  <small>
                    {transfer.status === 'pending'
                      ? 'Awaiting confirmation'
                      : transfer.status === 'failed'
                        ? transfer.direction === 'withdrawal'
                          ? 'Failed · Reserve returned'
                          : 'Failed · No credit'
                        : 'Confirmed'}
                  </small>
                </span>
                <span>
                  <strong>{xlm(transfer.amount)} XLM</strong>
                  <small>
                    <a
                      href={'https://stellar.expert/explorer/testnet/tx/' + transfer.hash}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View transaction
                    </a>
                  </small>
                  {transfer.status === 'pending' && transfer.direction === 'deposit' && (
                    <button
                      className="button outlined"
                      type="button"
                      disabled={busy}
                      onClick={() => transferAction('deposit', transfer.hash)}
                    >
                      Check deposit
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
