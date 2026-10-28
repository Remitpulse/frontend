import type { TransferState } from '@/lib/api/types'
import { cn } from '@/lib/cn'

const STYLES: Record<TransferState, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-mint-soft text-mint-dark' },
  in_progress: { label: 'In progress', className: 'bg-royal-soft text-royal' },
  failed: { label: 'Failed', className: 'bg-danger-soft text-danger' },
  needs_attention: { label: 'Needs attention', className: 'bg-danger-soft text-danger' },
  awaiting_funding: { label: 'Awaiting funding', className: 'bg-warn-soft text-warn' },
}

export function StatusPill({ state, className }: { state: TransferState; className?: string }) {
  const s = STYLES[state]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  )
}

export function Tag({
  children,
  tone = 'royal',
}: {
  children: React.ReactNode
  tone?: 'royal' | 'mint' | 'navy'
}) {
  const tones = {
    royal: 'bg-royal-soft text-royal',
    mint: 'bg-mint-soft text-mint-dark',
    navy: 'bg-white/10 text-sky-200',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}
