import { cn } from '@/lib/cn'

const TONES = [
  'bg-royal-soft text-royal',
  'bg-violet-100 text-violet-700',
  'bg-sky-50 text-sky-700',
]

export function Avatar({
  initials,
  size = 'md',
  className,
}: {
  initials: string
  size?: 'md' | 'lg'
  className?: string
}) {
  const tone = TONES[(initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % TONES.length]
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'lg' ? 'h-[52px] w-[52px] text-lg' : 'h-10 w-10 text-sm',
        tone,
        className,
      )}
    >
      {initials}
    </span>
  )
}
