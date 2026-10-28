import type { Recipient, TransferState, TransferSummary } from '@/lib/api/types'

/** Matches a search query against a recipient's name, country, or bank. Case- and accent-insensitive. */
export function filterRecipients(recipients: Recipient[], query: string): Recipient[] {
  const q = normalize(query)
  if (!q) return recipients
  return recipients.filter((r) =>
    [r.firstName, r.lastName, r.country, r.bankName].some(
      (field) => field && normalize(field).includes(q),
    ),
  )
}

export type ActivityStatusFilter = 'all' | TransferState

/** Filters transfer summaries by recipient-name search and/or status. */
export function filterTransfers(
  items: TransferSummary[],
  query: string,
  status: ActivityStatusFilter = 'all',
): TransferSummary[] {
  const q = normalize(query)
  return items.filter((t) => {
    if (status !== 'all' && t.state !== status) return false
    if (q && !normalize(t.recipientName).includes(q)) return false
    return true
  })
}

export interface CurrencyTotal {
  currency: string
  total: number
  count: number
}

/** Sums transfer amounts per send currency, descending by total. Used for the dashboard spend insight. */
export function summarizeByCurrency(items: TransferSummary[]): CurrencyTotal[] {
  const byCurrency = new Map<string, CurrencyTotal>()
  for (const t of items) {
    const amount = Number(t.amount)
    if (!Number.isFinite(amount)) continue
    const entry = byCurrency.get(t.currency) ?? { currency: t.currency, total: 0, count: 0 }
    entry.total += amount
    entry.count += 1
    byCurrency.set(t.currency, entry)
  }
  return [...byCurrency.values()].sort((a, b) => b.total - a.total)
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}
