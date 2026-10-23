import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { StatusPill } from '@/components/ui/StatusPill'
import type { TransferSummary } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'

export function ActivityList({ items }: { items: TransferSummary[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((t) => (
        <li key={t.id}>
          <Link href={`/transfers/${t.id}`} className="flex items-center gap-4 py-4">
            <Avatar initials={t.initials} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{t.recipientName}</p>
              <p className="text-caption text-muted">
                {t.date} · {t.method}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <p className="font-semibold text-ink">
                {t.currency === 'EUR' ? '€' : '$'}
                {formatMoney(t.amount)}
              </p>
              <StatusPill state={t.state} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
