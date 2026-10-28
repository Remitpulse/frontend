'use client'

import { useMemo, useState } from 'react'
import { ActivityList } from '@/components/ActivityList'
import { ErrorState } from '@/components/ui/ErrorState'
import { SearchIcon } from '@/components/ui/Icons'
import { SkeletonList } from '@/components/ui/Skeleton'
import { useAsyncData } from '@/hooks/useAsyncData'
import { api } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { filterTransfers, type ActivityStatusFilter } from '@/lib/filters'

const STATUS_FILTERS: { value: ActivityStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'awaiting_funding', label: 'Awaiting funding' },
]

/** M07 · Activity. */
export default function ActivityPage() {
  const { data: items, loading, error, reload } = useAsyncData('transfers', api.listTransfers)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ActivityStatusFilter>('all')

  const filtered = useMemo(() => filterTransfers(items ?? [], query, status), [items, query, status])

  return (
    <main className="mx-auto max-w-3xl px-6 pb-8 pt-8 lg:px-10 lg:pt-10">
      <h1 className="text-[26px] font-bold text-navy">Activity</h1>

      <div className="relative mt-5">
        <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by recipient"
          aria-label="Search activity by recipient"
          className="h-11 w-full rounded-control border border-border bg-white pl-10 pr-4 text-[15px] text-ink placeholder:text-slate-400 focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20"
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            aria-pressed={status === f.value}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium',
              status === f.value ? 'border-royal bg-royal-soft text-royal' : 'border-border bg-white text-muted hover:text-ink',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="mt-4">
          <SkeletonList count={5} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-body text-muted">{items && items.length > 0 ? 'No transfers match your search.' : 'No transfers yet.'}</p>
      ) : (
        <div className="animate-fade-in mt-4">
          <ActivityList items={filtered} />
        </div>
      )}
    </main>
  )
}
