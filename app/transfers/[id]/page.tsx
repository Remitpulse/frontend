'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { FlowHeader, FlowPage } from '@/components/layout/FlowHeader'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { TransferTracker } from '@/components/TransferTracker'
import { Button, Spinner } from '@/components/ui/Button'
import { Row } from '@/components/ui/Card'
import { AlertIcon, CopyIcon, ExternalIcon, LinkIcon } from '@/components/ui/Icons'
import { Tag } from '@/components/ui/StatusPill'
import { useTransferStatus } from '@/hooks/useTransferStatus'
import { formatMoney } from '@/lib/format'
import { explorerTxUrl } from '@/lib/stellar/network'

/** 06 · Live transaction tracking / 16 · Bank transfer delivered. */
export default function TransferTrackerPage() {
  return (
    <RequireAuth>
      <TrackerContent />
    </RequireAuth>
  )
}

function TrackerContent() {
  const { id } = useParams<{ id: string }>()
  const { status, error, lastSynced } = useTransferStatus(id)
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(what)
    setTimeout(() => setCopied(null), 2000)
  }

  if (!status) {
    return (
      <FlowPage>
        <FlowHeader title="Track transfer" backHref="/dashboard" />
        <div className="flex flex-col items-center gap-3 pt-24 text-muted" aria-live="polite">
          {error ? (
            <>
              <AlertIcon className="text-danger" />
              <p>{error}</p>
            </>
          ) : (
            <>
              <Spinner className="h-6 w-6 text-royal" />
              <p>Your money is on its way…</p>
            </>
          )}
        </div>
      </FlowPage>
    )
  }

  const first = status.recipientName.split(' ')[0]
  const isCash = status.deliveryLabel.startsWith('Cash')
  const done = status.state === 'completed'
  const headline =
    status.state === 'awaiting_funding'
      ? 'Waiting for your payment.'
      : done
        ? `Delivered to ${first}.`
        : status.state === 'failed' || status.state === 'needs_attention'
          ? 'This transfer needs attention'
          : `On its way to ${first}.`

  return (
    <FlowPage>
      <FlowHeader title="Track transfer" backHref="/dashboard" />

      <div className="mt-6">
        <Tag tone={done ? 'mint' : 'royal'}>
          {done ? 'Transfer complete' : status.state === 'awaiting_funding' ? 'Awaiting funding' : 'Transfer in progress'}
        </Tag>
      </div>
      <h2 className="mt-4 text-[26px] font-bold leading-tight text-navy" aria-live="polite">
        {headline}
      </h2>
      <p className="mt-2 text-body text-muted">
        {done ? 'Arrived safely.' : status.message ?? (isCash ? 'Ready for pickup in minutes' : 'Expected in under 1 minute')}
      </p>
      <p className="mt-4 text-[30px] font-bold tracking-tight text-navy">
        {formatMoney(status.receiveAmount)} {status.receiveCurrency}
      </p>

      <div className="mt-6">
        <TransferTracker status={status} isCash={isCash} />
      </div>

      <div className="mt-4 space-y-3 rounded-card border border-border bg-white p-5">
        <Row
          label="Reference"
          value={
            <span className="inline-flex items-center gap-3">
              {status.reference}
              <button onClick={() => copy(status.reference, 'ref')} aria-label="Copy reference" className="text-muted hover:text-ink">
                <CopyIcon size={18} />
              </button>
            </span>
          }
        />
        <Row label="Recipient" value={status.recipientName} />
        <Row label="Delivery" value={status.deliveryLabel} />
        {status.txHash && (
          <Row
            label="Stellar tx"
            value={
              <a href={explorerTxUrl(status.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-royal">
                {status.txHash.slice(0, 8)}… <ExternalIcon size={14} />
              </a>
            }
          />
        )}
      </div>

      <p className="mt-4 flex items-center gap-2 text-caption text-mint-dark" aria-live="polite">
        <span className="h-2 w-2 rounded-full bg-mint" />
        {done ? 'Final status' : `Live updates · Last synced ${lastSynced ? 'just now' : '—'}`}
        {copied && <span className="ml-auto text-muted">Copied</span>}
      </p>

      <Button className="mt-5" icon={<LinkIcon />} onClick={() => copy(window.location.href, 'link')}>
        Share tracking link
      </Button>
      <Link href="/dashboard" className="mt-4 block text-center text-body font-semibold text-royal">
        Back to dashboard
      </Link>
    </FlowPage>
  )
}
