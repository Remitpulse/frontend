'use client'

import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Wallet } from 'lucide-react'
import { getNetwork, isConnected, requestAccess, signTransaction } from '@stellar/freighter-api'
import type { CasinoState } from '@/lib/casino/catalog'
import { xlm } from '@/lib/casino/money'
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
  const [amount, setAmount] = useState('1')
  const [direction, setDirection] = useState<'deposit' | 'withdraw'>('deposit')
  const [eligible, setEligible] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hash, setHash] = useState('')
  const [signed, setSigned] = useState(() => {
    try {
      return typeof window === 'undefined'
        ? ''
        : window.sessionStorage.getItem('rp-testnet-deposit') || ''
    } catch {
      return ''
    }
  })

  async function requireTestnet() {
    const network = await getNetwork()
    if (network.error)
      throw new Error(
        'Freighter could not read the active network. Unlock the extension and try again.',
      )
    if (network.networkPassphrase !== testnet)
      throw new Error('Switch Freighter to Stellar Testnet, then try again.')
  }

  async function connect() {
    setError('')
    setStatus('')
    setMissingExtension(false)
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
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function transfer(retry?: 'deposit' | 'withdraw') {
    setError('')
    setHash('')
    setBusy(true)
    try {
      if (!retry) await requireTestnet()
      let result: Result
      if (retry === 'withdraw' || (!retry && direction === 'withdraw')) {
        setStatus('Waiting for Stellar Testnet confirmation…')
        result = await act({
          action: retry ? 'withdraw-retry' : 'withdraw',
          amount,
          wallet,
          eligible,
        })
      } else {
        let envelope = signed
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
          setSigned(envelope)
          try {
            window.sessionStorage.setItem('rp-testnet-deposit', envelope)
          } catch {
            // The current dialog can still submit or retry the signed payment.
          }
        }
        setStatus('Waiting for Stellar Testnet confirmation…')
        result = await act(
          retry && state?.deposit
            ? { action: 'deposit-retry', hash: state.deposit.hash }
            : { action: 'deposit-submit', xdr: envelope },
        )
        setSigned('')
        try {
          window.sessionStorage.removeItem('rp-testnet-deposit')
        } catch {
          // Transfer confirmation is already recorded by the server.
        }
      }
      setStatus(result.message || 'Transfer confirmed.')
      setHash(result.hash || '')
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
        <p className="connected" title={wallet}>
          Connected · {wallet.slice(0, 9)}…{wallet.slice(-6)}
        </p>
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
      <label>
        Amount
        <div className="amount-input">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            disabled={busy}
          />
          <span>XLM</span>
        </div>
      </label>
      <label className="check">
        <input type="checkbox" checked={eligible} onChange={(e) => setEligible(e.target.checked)} />{' '}
        I am eligible to participate and am using Testnet XLM.
      </label>
      {direction === 'deposit' && (state?.deposit || signed) && (
        <button className="button outlined" disabled={busy} onClick={() => transfer('deposit')}>
          Check signed deposit
        </button>
      )}
      {direction === 'withdraw' && state?.withdrawal ? (
        <button className="button primary" disabled={busy} onClick={() => transfer('withdraw')}>
          Check pending withdrawal
        </button>
      ) : (
        <button
          className="button primary"
          disabled={busy || !eligible || !wallet || !state?.walletEnabled}
          onClick={() => transfer()}
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
      {hash && (
        <a
          href={'https://stellar.expert/explorer/testnet/tx/' + hash}
          target="_blank"
          rel="noreferrer"
        >
          View in Stellar explorer
        </a>
      )}
    </section>
  )
}
