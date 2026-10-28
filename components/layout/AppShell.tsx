'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { HomeIcon, SendIcon, SettingsIcon, UsersIcon } from '@/components/ui/Icons'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/send', label: 'Send', icon: SendIcon },
  { href: '/recipients', label: 'Recipients', icon: UsersIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
]

/** Mobile: bottom tab bar. Desktop (≥1024px): 232px sidebar per Figma handoff notes. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-sidebar shrink-0 border-r border-border bg-white px-5 py-7 lg:block">
        <Logo />
        <nav className="mt-10 space-y-1" aria-label="Primary">
          {NAV.map(({ href, label, icon: I }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-control px-3 py-2.5 text-body font-medium',
                isActive(href)
                  ? 'bg-royal-soft text-royal'
                  : 'text-muted hover:bg-surface hover:text-ink',
              )}
            >
              <I size={20} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1 pb-24 lg:pb-0">{children}</div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV.map(({ href, label, icon: I }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 py-3 text-caption',
              isActive(href) ? 'text-royal' : 'text-muted',
            )}
          >
            <I size={22} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
