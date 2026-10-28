'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon, HelpIcon } from '@/components/ui/Icons'
import { cn } from '@/lib/cn'

interface FlowHeaderProps {
  title: string
  backHref?: string
  step?: { current: number; total: number; label: string }
}

/** "‹ Send money ⓘ" header with the 3-segment progress bar from the send flow. */
export function FlowHeader({ title, backHref, step }: FlowHeaderProps) {
  const router = useRouter()
  return (
    <header className="pb-2 pt-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (backHref ? router.push(backHref) : router.back())}
          className="-ml-2 rounded-full p-2 text-ink hover:bg-white"
          aria-label="Go back"
        >
          <ChevronLeftIcon size={22} />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-ink">{title}</h1>
        <Link
          href="/help"
          className="rounded-full p-1.5 text-muted hover:text-ink"
          aria-label="Help"
        >
          <HelpIcon size={22} />
        </Link>
      </div>
      {step && (
        <div className="mt-5">
          <p className="text-[13px] text-muted">
            {step.current} of {step.total} · {step.label}
          </p>
          <div
            className="mt-2 grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${step.total}, 1fr)` }}
            aria-hidden="true"
          >
            {Array.from({ length: step.total }, (_, i) => (
              <span
                key={i}
                className={cn('h-[3px] rounded-full', i < step.current ? 'bg-royal' : 'bg-border')}
              />
            ))}
          </div>
        </div>
      )}
    </header>
  )
}

export function FlowPage({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-dvh w-full max-w-flow px-6 pb-10">{children}</main>
}
