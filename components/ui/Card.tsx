import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-border bg-white', className)} {...props} />
}

export function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: React.ReactNode
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-body">
      <span className={strong ? 'text-ink' : 'text-muted'}>{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  )
}
