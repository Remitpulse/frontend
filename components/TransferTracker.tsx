import { BankIcon, CashIcon, CheckIcon } from '@/components/ui/Icons'
import type { TransferStage, TransferStatus } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'

const ORDER: TransferStage[] = ['received', 'converted', 'settling', 'delivered']

function steps(s: TransferStatus, isCash: boolean) {
  const sym = s.sendCurrency === 'EUR' ? '€' : '$'
  return [
    {
      id: 'received' as const,
      title: 'Payment received',
      detail: s.stage === 'funding' ? 'Waiting for your partner payment.' : `Your ${sym}${formatMoney(s.sendAmount)} payment is confirmed.`,
    },
    { id: 'converted' as const, title: 'Converted to digital dollars', detail: `Exchange rate locked at ${s.rate} ${s.receiveCurrency}.` },
    { id: 'settling' as const, title: 'Settling on Stellar', detail: 'Your money is moving securely.' },
    {
      id: 'delivered' as const,
      title: isCash ? 'Ready for pickup' : 'Deposited to recipient bank',
      detail: isCash ? 'We’ll text the pickup reference to your recipient.' : 'We’ll notify you both when it arrives.',
    },
  ]
}

/** Vertical progress tracker from 06 · Live transaction tracking. */
export function TransferTracker({ status, isCash }: { status: TransferStatus; isCash: boolean }) {
  const reached = status.stage === 'funding' ? -1 : ORDER.indexOf(status.stage)
  const complete = status.state === 'completed' || status.state === 'failed'

  return (
    <ol className="rounded-card border border-border bg-white p-5" aria-label="Transfer progress">
      {steps(status, isCash).map((step, i, all) => {
        // `stage` is the last milestone reached, so it and everything before it are done.
        const done = i <= reached
        const active = !complete && i === reached + 1
        const last = i === all.length - 1
        return (
          <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0" aria-current={active ? 'step' : undefined}>
            {!last && (
              <span
                aria-hidden="true"
                className={cn('absolute left-[13px] top-8 h-[calc(100%-28px)] w-0.5', done ? 'bg-mint' : 'bg-border')}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                done ? 'bg-mint-soft text-mint-dark' : active ? 'bg-royal-soft' : 'bg-surface text-muted',
              )}
            >
              {done ? (
                <CheckIcon size={16} />
              ) : active ? (
                <span className="h-3 w-3 animate-pulse rounded-full bg-royal" />
              ) : last ? (
                isCash ? <CashIcon size={16} /> : <BankIcon size={16} />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-300" />
              )}
            </span>
            <div>
              <p className={cn('text-body font-semibold', active ? 'text-royal' : done ? 'text-ink' : 'text-muted')}>
                {step.title}
                <span className="sr-only">{done ? ' — done' : active ? ' — in progress' : ' — pending'}</span>
              </p>
              <p className="mt-0.5 text-caption text-muted">{step.detail}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
