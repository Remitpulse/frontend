'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { FlowHeader, FlowPage } from '@/components/layout/FlowHeader'
import { useTransferDraft } from '@/components/providers/TransferDraftProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, Row } from '@/components/ui/Card'
import { AlertIcon, BankIcon, BoltIcon, FingerprintIcon, ShieldIcon } from '@/components/ui/Icons'
import { useSendTransfer } from '@/hooks/useSendTransfer'
import type { CreateTransferResponse, FundingSource } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { formatMoney, initials, maskAccount } from '@/lib/format'
import { CORRIDORS } from '@/lib/stellar/assets'

const Sep24Modal = dynamic(() => import('@/components/Sep24Modal').then((m) => m.Sep24Modal))

/** 04 · Review & biometric authorization → 05 · Secure partner funding gateway. */
export default function ReviewPage() {
  const router = useRouter()
  const { draft, update, reset } = useTransferDraft()
  const transfer = useSendTransfer()
  const [created, setCreated] = useState<CreateTransferResponse | null>(null)
  const leaving = useRef(false)
  const { quote, recipient } = draft

  useEffect(() => {
    if (!leaving.current && (!quote || !recipient)) router.replace('/send')
  }, [quote, recipient, router])

  if (!quote || !recipient) return null

  const corridor = CORRIDORS.find((c) => c.currency === quote.receiveCurrency)!
  const isCash = recipient.payoutMethod === 'cash'
  const quick = transfer.willUseSessionKey(quote.sendAmount)
  const sendSym = quote.sendCurrency === 'EUR' ? '€' : '$'
  const totalFees = (
    Number(quote.fees.platform) +
    Number(quote.fees.partner) +
    Number(quote.fees.network)
  ).toFixed(2)

  const goToTracker = (id: string) => {
    leaving.current = true
    router.push(`/transfers/${id}`)
    reset()
  }

  const confirm = async () => {
    try {
      const res = await transfer.send({
        quote,
        recipient,
        saveRecipient: draft.saveRecipient,
        funding: draft.funding,
      })
      if (res.sep24) setCreated(res)
      else goToTracker(res.transferId)
    } catch {
      // surfaced via transfer.error
    }
  }

  return (
    <FlowPage>
      <FlowHeader
        title="Review transfer"
        backHref="/send/recipient"
        step={{ current: 3, total: 3, label: 'Confirm' }}
      />

      <h2 className="mt-6 text-[26px] font-bold leading-tight text-navy">Ready when you are.</h2>
      <p className="mt-2 text-body text-muted">One final look before it’s on its way.</p>

      <Card className="mt-6 p-5">
        <p className="text-caption font-semibold uppercase tracking-wide text-muted">
          {recipient.firstName} receives
        </p>
        <p className="mt-2 text-[30px] font-bold tracking-tight text-navy">
          {formatMoney(quote.receiveAmount)} {quote.receiveCurrency}
        </p>
        <span className="mt-2 inline-block rounded-full bg-mint-soft px-3 py-1 text-[13px] text-mint-dark">
          {quote.deliveryEstimate}
        </span>

        <div className="mt-5 flex items-center gap-4 border-t border-border pt-5">
          <Avatar initials={initials(recipient.firstName, recipient.lastName)} />
          <div>
            <p className="font-semibold text-ink">
              {recipient.firstName} {recipient.lastName}
            </p>
            <p className="text-[13px] text-muted">
              {isCash
                ? `Cash pickup · ${recipient.mobile}`
                : `${recipient.bankName} · ${maskAccount(recipient.accountNumber)}`}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <Row
            label="Delivery"
            value={isCash ? 'Cash pickup · MoneyGram' : `Bank transfer · ${corridor.bankNetwork}`}
          />
          <Row
            label="Exchange rate"
            value={`1 ${quote.sendCurrency} = ${quote.rate} ${quote.receiveCurrency}`}
          />
          <Row label="All fees included" value={`${sendSym}${totalFees}`} />
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <Row
            label="Total you pay"
            strong
            value={`${sendSym}${formatMoney(quote.totalCost)} ${quote.sendCurrency}`}
          />
        </div>
      </Card>

      <fieldset className="mt-4">
        <legend className="sr-only">How you’ll pay</legend>
        <div className="space-y-2">
          <FundingOption
            value="partner"
            current={draft.funding}
            onSelect={(v) => update({ funding: v })}
            title="Pay via secure partner"
            detail="MoneyGram · Bank or cash (SEP-24)"
          />
          <FundingOption
            value="wallet"
            current={draft.funding}
            onSelect={(v) => update({ funding: v })}
            title="Pay from wallet balance"
            detail={`${quote.sendAsset} on Stellar · Instant`}
          />
        </div>
      </fieldset>

      <div className="mt-4 flex gap-3 rounded-control bg-royal-soft p-4 text-[13px] text-muted">
        {quick ? (
          <BoltIcon className="shrink-0 text-royal" size={20} />
        ) : (
          <ShieldIcon className="shrink-0 text-royal" size={20} />
        )}
        <p>
          {quick
            ? 'Quick send is on for this amount. Your device’s session key approves it without another prompt.'
            : 'Confirm with your passkey. Your device will ask for your fingerprint, face, or PIN.'}
        </p>
      </div>

      {transfer.error && (
        <p className="mt-4 flex items-start gap-2 text-[13px] text-danger" role="alert">
          <AlertIcon size={18} className="shrink-0" /> {transfer.error}
        </p>
      )}

      <Button
        className="mt-5"
        icon={quick ? <BoltIcon /> : <FingerprintIcon />}
        loading={transfer.isBusy}
        onClick={confirm}
      >
        {transfer.phase === 'authorizing'
          ? 'Checking your passkey…'
          : transfer.phase === 'submitting'
            ? 'Sending securely…'
            : quick
              ? 'Confirm & send'
              : 'Confirm with passkey'}
      </Button>
      <p className="mt-3 text-center text-caption text-muted">No network fees. Always.</p>

      {created?.sep24 && (
        <Sep24Modal
          open
          kind="deposit"
          sep24Id={created.sep24.id}
          url={created.sep24.url}
          anchorName={created.sep24.anchorName}
          transferId={created.transferId}
          summary={{
            amount: `${sendSym}${formatMoney(quote.totalCost)} ${quote.sendCurrency}`,
            counterparty: `${recipient.firstName} ${recipient.lastName}`,
          }}
          onComplete={() => goToTracker(created.transferId)}
          onClose={() => goToTracker(created.transferId)}
        />
      )}
    </FlowPage>
  )
}

function FundingOption(props: {
  value: FundingSource
  current: FundingSource
  onSelect: (v: FundingSource) => void
  title: string
  detail: string
}) {
  const selected = props.value === props.current
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-4 rounded-card border bg-white p-4',
        selected ? 'border-royal' : 'border-border',
      )}
    >
      <BankIcon className={selected ? 'text-royal' : 'text-muted'} />
      <span className="flex-1">
        <span className="block text-body font-semibold text-ink">{props.title}</span>
        <span className="block text-caption text-muted">{props.detail}</span>
      </span>
      <input
        type="radio"
        name="funding"
        className="h-4 w-4 accent-royal"
        checked={selected}
        onChange={() => props.onSelect(props.value)}
      />
    </label>
  )
}
