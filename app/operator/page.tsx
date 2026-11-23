'use client'

import { useState } from 'react'
import Link from 'next/link'
import { xlm } from '@/lib/casino/money'

type PendingTransfer = { hash: string; amount: string; wallet?: string | null }

type Report = {
  treasury: string | null
  treasuryIssue: string
  totals: { demo: string; testnet: string }
  activity: { kind: string; count: number; amount: string }[]
  pending: PendingTransfer[]
  reconciliation?: { reserved: string; liabilities: string; grossDifference: string | null }
  pendingDeposits?: PendingTransfer[]
}

export default function Operator() {
  const [token, setToken] = useState('')
  const [report, setReport] = useState<Report>()
  const [reportToken, setReportToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  async function loadReport(authorizedToken: string) {
    const response = await fetch('/api/casino?admin', {
      headers: { Authorization: 'Bearer ' + authorizedToken },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    setReportToken(authorizedToken)
    setReport(data)
  }

  async function onReconciled(message: string) {
    setNotice(message)
    setError('')
    setBusy(true)
    try {
      await loadReport(reportToken)
    } catch {
      setError('The transfer was reconciled, but the report could not refresh. Reload the report.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="operator">
      <Link href="/">RemitPulse lobby</Link>
      <p className="eyebrow">STELLAR TESTNET</p>
      <h1>Operator</h1>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          setNotice('')
          setBusy(true)
          try {
            await loadReport(token)
          } catch (failure) {
            setReport(undefined)
            setError((failure as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          Operator token
          <div className="amount-input">
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
            />
          </div>
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? 'Loading…' : 'Load report'}
        </button>
      </form>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {report && (
        <>
          <div className="summary-grid">
            <div>
              <span>Stellar treasury</span>
              <strong>
                {report.treasury === null
                  ? report.treasuryIssue || 'Unconfigured'
                  : xlm(report.treasury) + ' XLM'}
              </strong>
            </div>
            <div>
              <span>Testnet player balances available</span>
              <strong>{xlm(report.totals.testnet)} XLM</strong>
            </div>
            <div>
              <span>Simulated player balances</span>
              <strong>{xlm(report.totals.demo)} XLM</strong>
            </div>
          </div>
          {report.reconciliation && (
            <section>
              <h2>Treasury reconciliation</h2>
              <dl>
                <dt>Reserved withdrawals</dt>
                <dd>{xlm(report.reconciliation.reserved)} XLM</dd>
                <dt>Total recorded liabilities</dt>
                <dd>{xlm(report.reconciliation.liabilities)} XLM</dd>
                <dt>Treasury balance less recorded liabilities</dt>
                <dd>
                  {report.reconciliation.grossDifference === null
                    ? 'Unavailable'
                    : xlm(report.reconciliation.grossDifference) + ' XLM'}
                </dd>
              </dl>
              <p>
                Pending transfers can affect the comparison. The treasury balance includes Stellar
                account reserves.
              </p>
            </section>
          )}
          <h2>Ledger activity</h2>
          <ul className="history">
            {report.activity.map((item) => (
              <li key={item.kind}>
                <span>
                  <strong>{item.kind}</strong>
                  <small>{item.count} entries</small>
                </span>
                <strong>{xlm(item.amount)} XLM</strong>
              </li>
            ))}
          </ul>
          <TransferQueue
            title="Pending Testnet deposits"
            direction="inbound"
            token={reportToken}
            onReconciled={onReconciled}
            transfers={report.pendingDeposits}
          />
          <TransferQueue
            title="Pending Testnet withdrawals"
            direction="outbound"
            token={reportToken}
            onReconciled={onReconciled}
            transfers={report.pending}
          />
        </>
      )}
    </main>
  )
}

function TransferQueue({
  title,
  direction,
  token,
  onReconciled,
  transfers,
}: {
  title: string
  direction: 'inbound' | 'outbound'
  token: string
  onReconciled: (message: string) => Promise<void>
  transfers?: PendingTransfer[]
}) {
  return (
    <section>
      <h2>{title}</h2>
      {!transfers ? (
        <p className="empty">This report does not include this transfer queue.</p>
      ) : transfers.length ? (
        <ul className="history">
          {transfers.map((transfer) => (
            <li key={transfer.hash}>
              <a href={'https://stellar.expert/explorer/testnet/tx/' + transfer.hash}>
                <code>{transfer.hash}</code>
              </a>
              <span>
                <strong>{xlm(transfer.amount)} XLM</strong>
                <HorizonStatus hash={transfer.hash} token={token} onReconciled={onReconciled} />
                {transfer.wallet && (
                  <>
                    <small>Wallet {transfer.wallet}</small>
                    <a
                      download={`testnet-transfer-${transfer.hash.slice(0, 12)}.json`}
                      href={
                        'data:application/json;charset=utf-8,' +
                        encodeURIComponent(
                          JSON.stringify(
                            {
                              network: 'stellar-testnet',
                              hash: transfer.hash,
                              direction,
                              stroops: transfer.amount,
                              counterparty: transfer.wallet,
                            },
                            null,
                            2,
                          ),
                        )
                      }
                    >
                      Download transfer record
                    </a>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">No transfers awaiting confirmation.</p>
      )}
    </section>
  )
}

function HorizonStatus({
  hash,
  token,
  onReconciled,
}: {
  hash: string
  token: string
  onReconciled: (message: string) => Promise<void>
}) {
  const [status, setStatus] = useState('')
  const [checking, setChecking] = useState(false)
  const [canReconcile, setCanReconcile] = useState(false)
  async function check(reconcile = false) {
    setChecking(true)
    setCanReconcile(false)
    try {
      const response = await fetch('/api/casino?admin&transfer=' + hash, {
        headers: { Authorization: 'Bearer ' + token },
        method: reconcile ? 'POST' : 'GET',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      if (reconcile) {
        await onReconciled(data.message)
        return
      }
      setCanReconcile(data.status === 'confirmed')
      setStatus(
        data.status === 'not-found'
          ? 'Horizon has no record of this hash.'
          : data.status === 'confirmed'
            ? 'Confirmed on Testnet.'
            : 'Recorded as failed on Testnet.',
      )
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setChecking(false)
    }
  }
  return (
    <div>
      <button className="button outlined" type="button" disabled={checking} onClick={() => check()}>
        {checking ? 'Checking…' : 'Check network status'}
      </button>
      {canReconcile && (
        <button className="button outlined" type="button" onClick={() => check(true)}>
          Reconcile confirmed transfer
        </button>
      )}
      {status && <small role="status">{status}</small>}
    </div>
  )
}
