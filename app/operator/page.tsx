'use client'

import { useState } from 'react'
import Link from 'next/link'
import { xlm } from '@/lib/casino/money'

type Report = {
  treasury: string | null
  treasuryIssue: string
  totals: { demo: string; testnet: string }
  activity: { kind: string; count: number; amount: string }[]
  pending: { hash: string; amount: string }[]
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
          <h2>Pending Testnet withdrawals</h2>
          {report.pending.length ? (
            <ul className="history">
              {report.pending.map((transfer) => (
                <li key={transfer.hash}>
                  <a href={'https://stellar.expert/explorer/testnet/tx/' + transfer.hash}>
                    Stellar transaction
                  </a>
                  <strong>{xlm(transfer.amount)} XLM</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No withdrawals awaiting confirmation.</p>
          )}
        </>
      )}
    </main>
  )
}
