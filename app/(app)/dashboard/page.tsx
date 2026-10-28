'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ActivityList } from '@/components/ActivityList'
import { SpendByCurrency } from '@/components/SpendByCurrency'
import { Logo } from '@/components/layout/Logo'
import { useAuth } from '@/components/providers/AuthProvider'
import { useTransferDraft } from '@/components/providers/TransferDraftProvider'
import { Avatar } from '@/components/ui/Avatar'
import { ButtonLink } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { ArrowRightIcon, PlusIcon, SendIcon } from '@/components/ui/Icons'
import { SkeletonCircle, SkeletonList } from '@/components/ui/Skeleton'
import { useAsyncData } from '@/hooks/useAsyncData'
import { api } from '@/lib/api/client'
import { summarizeByCurrency } from '@/lib/filters'
import { formatMoney, greeting, initials } from '@/lib/format'

/** 07 · Mobile dashboard & wallet / 09 · Desktop dashboard. */
export default function DashboardPage() {
  const { session } = useAuth()
  const { update } = useTransferDraft()

  const balanceKey = session ? `balance:${session.contractId}` : null
  const { data: balance } = useAsyncData(balanceKey, () => api.getBalance(session!.contractId))
  const { data: recipients, loading: recipientsLoading } = useAsyncData(
    session ? 'recipients' : null,
    api.listRecipients,
  )
  const {
    data: activity,
    loading: activityLoading,
    error: activityError,
    reload: reloadActivity,
  } = useAsyncData(session ? 'transfers' : null, api.listTransfers)

  const totals = useMemo(() => summarizeByCurrency(activity ?? []), [activity])
  const name =
    session?.displayName && session.displayName !== 'RemitPulse account'
      ? `, ${session.displayName}`
      : ''

  return (
    <main className="mx-auto max-w-3xl px-6 pb-8 pt-6 lg:px-10 lg:pt-10">
      <header className="lg:hidden">
        <Logo />
      </header>

      <h1 className="mt-8 text-[26px] font-bold text-navy lg:mt-0">
        {greeting()}
        {name}
      </h1>
      <p className="mt-1 text-body text-muted">A little closer, wherever you are.</p>

      <section
        className="animate-fade-in mt-6 rounded-card bg-navy p-5 text-white"
        aria-label="Wallet balance"
      >
        <p className="text-body text-slate-300">Available balance</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[34px] font-bold tracking-tight">
            {balance ? `$${formatMoney(balance.amount)}` : '—'}
          </p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-sky-100">
            {balance?.asset ?? 'USDC'}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
          <ButtonLink href="/send" icon={<ArrowRightIcon />}>
            Send money
          </ButtonLink>
          <ButtonLink href="/wallet" variant="inverse">
            Add money
          </ButtonLink>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="send-again">
        <div className="flex items-center justify-between">
          <h2 id="send-again" className="text-lg font-semibold text-ink">
            Send again
          </h2>
          <Link href="/recipients" className="text-[13px] font-medium text-royal">
            View all
          </Link>
        </div>
        {recipientsLoading ? (
          <div className="mt-4 flex gap-6">
            {[0, 1, 2].map((i) => (
              <SkeletonCircle key={i} size={52} />
            ))}
          </div>
        ) : (
          <ul className="mt-4 flex gap-6 overflow-x-auto pb-1">
            {(recipients ?? []).slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link
                  href="/send"
                  onClick={() => update({ recipient: r, payoutMethod: r.payoutMethod })}
                  className="flex w-16 flex-col items-center gap-2 text-[13px] text-ink"
                >
                  <Avatar initials={initials(r.firstName, r.lastName)} size="lg" />
                  {r.firstName}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/send"
                onClick={() => update({ recipient: null })}
                className="flex w-16 flex-col items-center gap-2 text-[13px] text-ink"
              >
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-border bg-white text-royal">
                  <PlusIcon />
                </span>
                New
              </Link>
            </li>
          </ul>
        )}
      </section>

      {totals.length > 0 && (
        <section className="mt-8" aria-labelledby="spend-insight">
          <h2 id="spend-insight" className="text-lg font-semibold text-ink">
            Sent by currency
          </h2>
          <div className="mt-4 rounded-card border border-border bg-white p-5">
            <SpendByCurrency totals={totals} />
          </div>
        </section>
      )}

      <section className="mt-8" aria-labelledby="recent">
        <div className="flex items-center justify-between">
          <h2 id="recent" className="text-lg font-semibold text-ink">
            Recent activity
          </h2>
          <Link href="/activity" className="text-[13px] font-medium text-royal">
            View all
          </Link>
        </div>
        {activityError ? (
          <ErrorState message={activityError} onRetry={reloadActivity} />
        ) : activityLoading ? (
          <div className="mt-2">
            <SkeletonList count={3} />
          </div>
        ) : activity && activity.length === 0 ? (
          <EmptyActivity />
        ) : (
          <div className="mt-2">
            <ActivityList items={(activity ?? []).slice(0, 5)} />
          </div>
        )}
      </section>
    </main>
  )
}

function EmptyActivity() {
  return (
    <div className="mt-4 rounded-card border border-border bg-white p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint-soft text-mint-dark">
        <SendIcon size={18} />
      </span>
      <p className="mt-4 text-lg font-semibold text-ink">Your first hello starts here.</p>
      <p className="mt-2 text-body text-muted">
        Send money to someone who matters. Your transfers will appear here.
      </p>
      <Link
        href="/send"
        className="mt-4 inline-flex items-center gap-2 text-body font-semibold text-royal"
      >
        Send your first transfer <ArrowRightIcon size={16} />
      </Link>
    </div>
  )
}
