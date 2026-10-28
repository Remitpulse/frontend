'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { CurrencyAmountInput } from '@/components/CurrencyAmountInput'
import { FeeBreakdown } from '@/components/FeeBreakdown'
import { FlowHeader, FlowPage } from '@/components/layout/FlowHeader'
import { useTransferDraft } from '@/components/providers/TransferDraftProvider'
import { Button } from '@/components/ui/Button'
import {
  AlertIcon,
  ArrowRightIcon,
  BankIcon,
  CashIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
} from '@/components/ui/Icons'
import { useQuote } from '@/hooks/useQuote'
import { cn } from '@/lib/cn'
import { formatCountdown, formatMoney } from '@/lib/format'
import {
  CORRIDORS,
  SEND_OPTIONS,
  STABLECOINS,
  type ReceiveCurrency,
  type SendCurrency,
} from '@/lib/stellar/assets'

/** 02 · Send money calculator. */
export default function SendCalculatorPage() {
  const router = useRouter()
  const { draft, update } = useTransferDraft()
  const corridor = CORRIDORS.find((c) => c.currency === draft.receiveCurrency)!
  const { quote, loading, error, secondsLeft, expired, refresh } = useQuote({
    sendAmount: draft.sendAmount,
    sendCurrency: draft.sendCurrency,
    receiveCurrency: draft.receiveCurrency,
  })

  // Corridors without cash pickup fall back to bank transfer.
  useEffect(() => {
    if (!corridor.payoutMethods.includes(draft.payoutMethod)) update({ payoutMethod: 'bank' })
  }, [corridor, draft.payoutMethod, update])

  const sendOption = SEND_OPTIONS.find((o) => o.currency === draft.sendCurrency)!
  const canContinue = !!quote && !loading && !expired && Number(draft.sendAmount) > 0

  return (
    <FlowPage>
      <FlowHeader
        title="Send money"
        backHref="/dashboard"
        step={{ current: 1, total: 3, label: 'Amount' }}
      />

      <h2 className="mt-6 text-[26px] font-bold leading-tight text-navy">
        A little goes a long way.
      </h2>
      <p className="mt-2 text-body text-muted">
        Send to {corridor.countryName}, straight from your phone.
      </p>

      <div className="mt-6 space-y-3">
        <CurrencyAmountInput
          label="You send"
          amount={draft.sendAmount}
          onAmountChange={(v) => update({ sendAmount: v })}
          currency={draft.sendCurrency}
          options={SEND_OPTIONS.map((o) => ({
            value: o.currency,
            country: o.country,
            label: `${o.currency} · ${o.asset}`,
          }))}
          onCurrencyChange={(v) => update({ sendCurrency: v as SendCurrency })}
        />
        <CurrencyAmountInput
          label="They receive"
          amount={quote ? formatMoney(quote.receiveAmount) : '—'}
          readOnly
          highlighted
          loading={loading}
          currency={draft.receiveCurrency}
          options={CORRIDORS.filter((c) => c.available).map((c) => ({
            value: c.currency,
            country: c.country,
            label: `${c.currency} · ${c.settlementAsset}`,
          }))}
          onCurrencyChange={(v) => update({ receiveCurrency: v as ReceiveCurrency })}
        />
      </div>

      <div aria-live="polite">
        {quote && !expired && (
          <div className="mt-4 flex items-center justify-between rounded-control bg-mint-soft px-4 py-3">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-mint-dark">
              <CheckIcon size={18} /> 1 {quote.sendCurrency} = {quote.rate} {quote.receiveCurrency}
            </span>
            <span className="text-caption text-mint-dark">
              Rate locked · {formatCountdown(secondsLeft)}
            </span>
          </div>
        )}
        {expired && (
          <div className="mt-4 flex items-start gap-3 rounded-control bg-warn-soft px-4 py-3 text-warn">
            <ClockIcon size={20} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-body font-semibold">Your rate has expired.</p>
              <p className="text-caption">
                Refresh the quote and review the new amount before continuing.
              </p>
            </div>
            <button onClick={refresh} className="text-[13px] font-semibold">
              Refresh quote →
            </button>
          </div>
        )}
        {error && (
          <p className="mt-4 flex items-center gap-2 text-caption text-danger" role="alert">
            <AlertIcon size={16} /> {error}
          </p>
        )}
      </div>

      {quote && (
        <div className="mt-5 border-b border-border pb-5">
          <FeeBreakdown quote={quote} />
          <p className="mt-3 text-caption text-muted">
            Settles on Stellar as {STABLECOINS[sendOption.asset].code}
            {quote.settlementAsset !== sendOption.asset &&
              ` → ${STABLECOINS[quote.settlementAsset].code}`}
            .
          </p>
        </div>
      )}

      <fieldset className="mt-5">
        <legend className="text-[15px] font-semibold text-ink">How should it arrive?</legend>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <PayoutOption
            selected={draft.payoutMethod === 'bank'}
            onSelect={() => update({ payoutMethod: 'bank' })}
            icon={<BankIcon />}
            title="Bank transfer"
            detail={`${corridor.bankNetwork} · ${corridor.currency === 'MXN' ? 'Under 1 min' : 'Minutes'}`}
          />
          <PayoutOption
            selected={draft.payoutMethod === 'cash'}
            onSelect={() => update({ payoutMethod: 'cash' })}
            icon={<CashIcon />}
            title="Cash pickup"
            detail="MoneyGram · Minutes"
            disabled={!corridor.payoutMethods.includes('cash')}
          />
        </div>
      </fieldset>

      <Button
        className="mt-6"
        icon={<ArrowRightIcon />}
        disabled={!canContinue}
        onClick={() => {
          update({ quote })
          router.push('/send/recipient')
        }}
      >
        Continue to recipient
      </Button>
      <p className="mt-3 text-center text-caption text-muted">
        You’ll review everything before sending.
      </p>
    </FlowPage>
  )
}

function PayoutOption(props: {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  title: string
  detail: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      disabled={props.disabled}
      onClick={props.onSelect}
      className={cn(
        'relative rounded-control border p-4 text-left transition-colors disabled:opacity-40',
        props.selected
          ? 'border-royal bg-royal-soft'
          : 'border-border bg-white hover:border-slate-300',
      )}
    >
      <span className={props.selected ? 'text-royal' : 'text-muted'}>{props.icon}</span>
      {props.selected && (
        <CheckCircleIcon size={20} className="absolute right-3 top-3 text-royal" />
      )}
      <p className="mt-3 text-body font-semibold text-ink">{props.title}</p>
      <p className="mt-0.5 text-caption text-muted">
        {props.disabled ? 'Not available yet' : props.detail}
      </p>
    </button>
  )
}
