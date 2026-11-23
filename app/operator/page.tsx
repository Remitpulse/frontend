'use client'

import { useState } from 'react'
import Link from 'next/link'
import { xlm } from '@/lib/casino/money'

type PendingDirection = 'inbound' | 'outbound'

type PendingTransfer = { hash: string; amount: string; wallet?: string | null }

type Report = {
  treasury: string | null
  treasuryIssue: string
  totals: { demo: string; testnet: string }
  activity: { kind: string; count: number; amount: string }[]
  pending: PendingTransfer[]
  reconciliation?: {
    reserved: string
    liabilities: string
    grossDifference: string | null
    balanceAudit?: {
      mismatchedPlayers: number
      missingPlayers: number
      reservationMismatches?: number
      depositCreditMismatches?: number
    }
  }
  pendingDeposits?: PendingTransfer[]
  footballRevisions?: {
    event: string
    originalScore: string
    revisedScore: string
    observed: number
    settledTickets: number
  }[]
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
              {report.reconciliation.balanceAudit && (
                <LedgerChecks audit={report.reconciliation.balanceAudit} />
              )}
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
          {!!report.footballRevisions?.length && (
            <section>
              <h2>Football score revisions</h2>
              <ul className="history">
                {report.footballRevisions.map((revision) => (
                  <li key={revision.event}>
                    <span>
                      <strong>Match {revision.event.replace('football-data:', '')}</strong>
                      <small>{new Date(revision.observed).toLocaleString()}</small>
                    </span>
                    <span>
                      <strong>
                        {revision.originalScore} → {revision.revisedScore}
                      </strong>
                      <small>
                        {revision.settledTickets} settled ticket
                        {revision.settledTickets === 1 ? '' : 's'}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}

function LedgerChecks({
  audit,
}: {
  audit: NonNullable<NonNullable<Report['reconciliation']>['balanceAudit']>
}) {
  const checks = [
    ['Player balances', audit.mismatchedPlayers],
    ['Missing players', audit.missingPlayers],
    ['Deposit credits', audit.depositCreditMismatches],
    ['Withdrawal reservations', audit.reservationMismatches],
  ] as const
  return (
    <dl aria-label="Testnet ledger checks">
      {checks
        .filter(([, count]) => count !== undefined)
        .map(([label, count]) => (
          <div key={label} className={count ? 'error-text' : undefined}>
            <dt>{label}</dt>
            <dd>
              {count ? `${count} discrepanc${count === 1 ? 'y' : 'ies'}` : 'No discrepancies'}
            </dd>
          </div>
        ))}
    </dl>
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
  direction: PendingDirection
  token: string
  onReconciled: (message: string) => Promise<void>
  transfers?: PendingTransfer[]
}) {
  return (
    <section className="operator-transfer-queue">
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
                <HorizonStatus
                  hash={transfer.hash}
                  token={token}
                  direction={direction}
                  onReconciled={onReconciled}
                />
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
  direction,
  onReconciled,
}: {
  hash: string
  token: string
  direction: PendingDirection
  onReconciled: (message: string) => Promise<void>
}) {
  const [status, setStatus] = useState('')
  const [checking, setChecking] = useState(false)
  const [recovery, setRecovery] = useState<'confirmed' | 'failed'>()
  async function check(reconcile = false) {
    setChecking(true)
    setRecovery(undefined)
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
      if (data.status === 'confirmed' || data.status === 'failed') {
        setRecovery(data.status)
      }
      const expired = typeof data.expiresAt === 'number' && data.expiresAt < Date.now()
      setStatus(
        data.status === 'not-found'
          ? expired
            ? 'The signed envelope expired and Horizon has no record of this hash. Investigate before releasing any reserve.'
            : 'Horizon has no record of this hash.'
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
      {recovery && (
        <button className="button outlined" type="button" onClick={() => check(true)}>
          {recovery === 'failed'
            ? direction === 'outbound'
              ? 'Return failed withdrawal reserve'
              : 'Close failed deposit without credit'
            : 'Reconcile confirmed transfer'}
        </button>
      )}
      {status && <small role="status">{status}</small>}
    </div>
  )
}
