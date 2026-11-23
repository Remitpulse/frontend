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
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <main className="operator">
      <Link href="/">RemitPulse lobby</Link>
      <p className="eyebrow">STELLAR TESTNET</p>
      <h1>Operator</h1>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          setBusy(true)
          try {
            const response = await fetch('/api/casino?admin', {
              headers: { Authorization: 'Bearer ' + token },
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error)
            setReport(data)
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
            transfers={report.pendingDeposits}
          />
          <TransferQueue
            title="Pending Testnet withdrawals"
            direction="outbound"
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
  transfers,
}: {
  title: string
  direction: 'inbound' | 'outbound'
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
