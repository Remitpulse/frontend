'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useTransferDraft } from '@/components/providers/TransferDraftProvider'
import { Avatar } from '@/components/ui/Avatar'
import { ButtonLink } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { ChevronRightIcon, PlusIcon, SearchIcon } from '@/components/ui/Icons'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { useAsyncData } from '@/hooks/useAsyncData'
import { api } from '@/lib/api/client'
import { filterRecipients } from '@/lib/filters'
import { initials, maskAccount } from '@/lib/format'
import { CORRIDORS } from '@/lib/stellar/assets'

/** M12 · Recipients. */
export default function RecipientsPage() {
  const { update } = useTransferDraft()
  const { data: items, loading, error, reload } = useAsyncData('recipients', api.listRecipients)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => filterRecipients(items ?? [], query), [items, query])

  return (
    <main className="mx-auto max-w-flow px-6 pb-8 pt-8 lg:pt-10">
      <h1 className="text-[26px] font-bold text-navy">Recipients</h1>

      {items && items.length > 0 && (
        <div className="relative mt-5">
          <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, country, or bank"
            aria-label="Search recipients"
            className="h-11 w-full rounded-control border border-border bg-white pl-10 pr-4 text-[15px] text-ink placeholder:text-slate-400 focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20"
          />
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="mt-4">
          <ListSkeleton rows={4} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-body text-muted">{items && items.length > 0 ? 'No recipients match your search.' : 'No recipients yet.'}</p>
      ) : (
        <ul className="animate-fade-in mt-4 divide-y divide-border">
          {filtered.map((r) => {
            const corridor = CORRIDORS.find((c) => c.country === r.country)
            return (
              <li key={r.id}>
                <Link
                  href="/send"
                  onClick={() => update({ recipient: r, payoutMethod: r.payoutMethod, receiveCurrency: corridor?.currency ?? 'MXN' })}
                  className="flex items-center gap-4 py-4"
                >
                  <Avatar initials={initials(r.firstName, r.lastName)} />
                  <div className="flex-1">
                    <p className="font-semibold text-ink">
                      {r.firstName} {r.lastName}
                    </p>
                    <p className="text-caption text-muted">
                      {r.payoutMethod === 'cash' ? 'Cash pickup' : `${r.bankName} · ${maskAccount(r.accountNumber)}`} · {corridor?.countryName}
                    </p>
                  </div>
                  <ChevronRightIcon className="text-muted" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <ButtonLink href="/send" variant="secondary" icon={<PlusIcon />} className="mt-6">
        Add recipient
      </ButtonLink>
    </main>
  )
}
