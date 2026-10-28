import { describe, expect, it } from 'vitest'
import { filterRecipients, filterTransfers, summarizeByCurrency } from '@/lib/filters'
import type { Recipient, TransferSummary } from '@/lib/api/types'

const RECIPIENTS: Recipient[] = [
  { id: 'r1', firstName: 'María', lastName: 'López', country: 'MX', payoutMethod: 'bank', bankName: 'BBVA México' },
  { id: 'r2', firstName: 'José', lastName: 'López', country: 'MX', payoutMethod: 'cash' },
  { id: 'r3', firstName: 'Ana', lastName: 'Costa', country: 'BR', payoutMethod: 'bank', bankName: 'Nubank' },
]

describe('filterRecipients', () => {
  it('returns everything for an empty query', () => {
    expect(filterRecipients(RECIPIENTS, '')).toHaveLength(3)
    expect(filterRecipients(RECIPIENTS, '   ')).toHaveLength(3)
  })

  it('matches first or last name, case- and accent-insensitive', () => {
    expect(filterRecipients(RECIPIENTS, 'maria')).toEqual([RECIPIENTS[0]])
    expect(filterRecipients(RECIPIENTS, 'LOPEZ')).toEqual([RECIPIENTS[0], RECIPIENTS[1]])
  })

  it('matches bank name and country', () => {
    expect(filterRecipients(RECIPIENTS, 'nubank')).toEqual([RECIPIENTS[2]])
    expect(filterRecipients(RECIPIENTS, 'br')).toEqual([RECIPIENTS[2]])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterRecipients(RECIPIENTS, 'zzz')).toEqual([])
  })
})

const TRANSFERS: TransferSummary[] = [
  { id: 't1', recipientName: 'María López', initials: 'ML', amount: '500.00', currency: 'USD', date: 'Today', method: 'Bank transfer', state: 'in_progress' },
  { id: 't2', recipientName: 'José López', initials: 'JL', amount: '250.00', currency: 'USD', date: 'Oct 12', method: 'Cash pickup', state: 'completed' },
  { id: 't3', recipientName: 'Ana Costa', initials: 'AC', amount: '120.50', currency: 'EUR', date: 'Oct 05', method: 'Bank transfer', state: 'completed' },
]

describe('filterTransfers', () => {
  it('defaults to all statuses', () => {
    expect(filterTransfers(TRANSFERS, '')).toHaveLength(3)
  })

  it('filters by status', () => {
    expect(filterTransfers(TRANSFERS, '', 'completed')).toEqual([TRANSFERS[1], TRANSFERS[2]])
  })

  it('filters by recipient name search', () => {
    expect(filterTransfers(TRANSFERS, 'lopez')).toEqual([TRANSFERS[0], TRANSFERS[1]])
  })

  it('combines search and status', () => {
    expect(filterTransfers(TRANSFERS, 'lopez', 'completed')).toEqual([TRANSFERS[1]])
  })
})

describe('summarizeByCurrency', () => {
  it('sums amounts per currency, sorted descending by total', () => {
    expect(summarizeByCurrency(TRANSFERS)).toEqual([
      { currency: 'USD', total: 750, count: 2 },
      { currency: 'EUR', total: 120.5, count: 1 },
    ])
  })

  it('ignores non-numeric amounts', () => {
    const items: TransferSummary[] = [{ ...TRANSFERS[0]!, amount: 'not-a-number' }]
    expect(summarizeByCurrency(items)).toEqual([])
  })

  it('returns an empty array for no transfers', () => {
    expect(summarizeByCurrency([])).toEqual([])
  })
})
