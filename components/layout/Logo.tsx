import { SendIcon } from '@/components/ui/Icons'
import { cn } from '@/lib/cn'

export function Logo({ inverted, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-royal text-white">
        <SendIcon size={18} />
      </span>
      <span
        className={cn('text-xl font-bold tracking-tight', inverted ? 'text-white' : 'text-navy')}
      >
        RemitPulse
      </span>
    </span>
  )
}
