'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { Sep24Modal } from '@/components/Sep24Modal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CopyIcon, PlusIcon, SendIcon } from '@/components/ui/Icons'
import { api } from '@/lib/api/client'
import { config, type AssetCode } from '@/lib/config'
import { formatMoney, shortAddress } from '@/lib/format'
import { STABLECOINS } from '@/lib/stellar/assets'

type Flow = { kind: 'deposit' | 'withdraw'; id: string; url: string | null; anchorName: string }

/** M18 · Your wallet / M19 · Add money — SEP-24 deposits & withdrawals. */
export default function WalletPage() {
  const { session } = useAuth()
  const [asset, setAsset] = useState<AssetCode>('USDC')
  const [balance, setBalance] = useState<string | null>(null)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [starting, setStarting] = useState<Flow['kind'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadBalance = () => {
    if (session) api.getBalance(session.contractId).then((b) => setBalance(b.amount), () => setBalance(null))
  }
  useEffect(loadBalance, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (kind: Flow['kind']) => {
    setStarting(kind)
    setError(null)
    try {
      setFlow({ kind, ...(await api.startSep24({ kind, asset })) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the partner.')
    } finally {
      setStarting(null)
    }
  }

  if (!session) return null

  return (
    <main className="mx-auto max-w-flow px-6 pb-8 pt-8 lg:pt-10">
      <h1 className="text-[26px] font-bold text-navy">Your wallet</h1>
      <p className="mt-1 text-body text-muted">Stablecoins held by your passkey-secured smart account.</p>

      <Card className="mt-6 p-5">
        <p className="text-body text-muted">Available balance</p>
        <p className="mt-1 text-[32px] font-bold text-navy">${balance ? formatMoney(balance) : '—'}</p>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(session.contractId)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-caption text-muted hover:text-ink"
        >
          {shortAddress(session.contractId)} <CopyIcon size={14} /> {copied && 'Copied'}
        </button>
      </Card>

      <fieldset className="mt-6">
        <legend className="text-[15px] font-semibold text-ink">Asset</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(STABLECOINS) as AssetCode[]).map((code) => (
            <label key={code} className={`cursor-pointer rounded-control border px-3 py-2.5 text-center text-body font-medium ${asset === code ? 'border-royal bg-royal-soft text-royal' : 'border-border bg-white text-ink'}`}>
              <input type="radio" name="asset" value={code} checked={asset === code} onChange={() => setAsset(code)} className="sr-only" />
              {code}
              <span className="block text-caption font-normal text-muted">{STABLECOINS[code].fiat}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 space-y-3">
        <Button icon={<PlusIcon />} loading={starting === 'deposit'} onClick={() => start('deposit')}>
          Add money
        </Button>
        <Button variant="secondary" icon={<SendIcon />} loading={starting === 'withdraw'} onClick={() => start('withdraw')}>
          Cash out to bank
        </Button>
      </div>
      {error && (
        <p className="mt-3 text-caption text-danger" role="alert">
          {error}
        </p>
      )}
      <p className="mt-4 text-caption text-muted">
        Deposits and withdrawals run through a licensed Stellar anchor (SEP-24) on {config.network}.
      </p>

      {flow && (
        <Sep24Modal
          open
          kind={flow.kind}
          sep24Id={flow.id}
          url={flow.url}
          anchorName={flow.anchorName}
          summary={{ amount: asset, counterparty: flow.kind === 'deposit' ? 'Your wallet' : 'Your bank' }}
          onComplete={() => {
            setFlow(null)
            loadBalance()
          }}
          onClose={() => setFlow(null)}
        />
      )}
    </main>
  )
}
