import type { Quote } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { Row } from '@/components/ui/Card'

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€' }

export function FeeBreakdown({ quote }: { quote: Quote }) {
  const sym = SYMBOL[quote.sendCurrency] ?? ''
  return (
    <div className="space-y-3">
      <Row label="RemitPulse fee" value={`${sym}${quote.fees.platform}`} />
      <Row label="Partner fee" value={`${sym}${quote.fees.partner}`} />
      <Row label="Network fee (sponsored)" value={`${sym}${quote.fees.network}`} />
      <Row label="Amount converted" value={`${sym}${formatMoney(quote.amountConverted)}`} />
    </div>
  )
}
