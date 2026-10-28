import type { CurrencyTotal } from '@/lib/filters'
import { formatMoney } from '@/lib/format'

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€' }

/**
 * Magnitude-only breakdown of sent totals per currency: one hue, length
 * encodes the amount, and the amount is already the direct label, so no
 * legend or color-only identity is needed for a single series.
 */
export function SpendByCurrency({ totals }: { totals: CurrencyTotal[] }) {
  if (totals.length === 0) return null
  const max = Math.max(...totals.map((t) => t.total))

  return (
    <div className="space-y-3" role="img" aria-label={`Total sent by currency: ${totals.map((t) => `${t.currency} ${formatMoney(t.total)}`).join(', ')}`}>
      {totals.map((t) => (
        <div key={t.currency} aria-hidden="true">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="font-semibold text-ink">{t.currency}</span>
            <span className="text-muted">
              {SYMBOL[t.currency] ?? ''}
              {formatMoney(t.total)} · {t.count} {t.count === 1 ? 'transfer' : 'transfers'}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border/60">
            <div
              className="h-full rounded-full bg-royal transition-[width] duration-500"
              style={{ width: `${max > 0 ? Math.max(4, (t.total / max) * 100) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
