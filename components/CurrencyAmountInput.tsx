'use client'

import { useId } from 'react'
import { cn } from '@/lib/cn'

interface Option {
  value: string
  country: string
  label: string
}

interface Props {
  label: string
  amount: string
  onAmountChange?: (v: string) => void
  currency: string
  options: Option[]
  onCurrencyChange: (v: string) => void
  readOnly?: boolean
  highlighted?: boolean
  loading?: boolean
}

/** "You send / They receive" amount card from 02 · Send money calculator. */
export function CurrencyAmountInput({
  label,
  amount,
  onAmountChange,
  currency,
  options,
  onCurrencyChange,
  readOnly,
  highlighted,
  loading,
}: Props) {
  const id = useId()
  return (
    <div
      className={cn(
        'rounded-card border bg-white px-4 py-4',
        highlighted ? 'border-royal' : 'border-border',
      )}
    >
      <label htmlFor={`${id}-amt`} className="text-[13px] text-muted">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-3">
        <input
          id={`${id}-amt`}
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          readOnly={readOnly}
          aria-busy={loading}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.]/g, '')
            if (/^\d*\.?\d{0,2}$/.test(v)) onAmountChange?.(v)
          }}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-[32px] font-semibold tracking-tight text-navy outline-none',
            loading && 'opacity-50',
          )}
        />
        <label className="sr-only" htmlFor={`${id}-cur`}>
          {label} currency
        </label>
        <select
          id={`${id}-cur`}
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="h-9 cursor-pointer appearance-none rounded-full bg-surface px-4 text-[13px] font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-royal"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.country} {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
