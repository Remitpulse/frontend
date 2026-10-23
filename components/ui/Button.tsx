import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'inverse' | 'link'

const base =
  'inline-flex items-center justify-center gap-2.5 rounded-control font-semibold text-[15px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'h-action w-full bg-royal px-5 text-white hover:bg-royal-hover',
  secondary: 'h-action w-full border border-border bg-white px-5 text-ink hover:bg-surface',
  inverse: 'h-action bg-white px-5 text-ink hover:bg-surface',
  link: 'h-auto px-0 text-royal hover:underline',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  icon?: ReactNode
  loading?: boolean
}

export function Button({ variant = 'primary', icon, loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], className)} disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading ? <Spinner /> : null}
      <span>{children}</span>
      {!loading && icon}
    </button>
  )
}

export function ButtonLink({
  href,
  variant = 'primary',
  icon,
  className,
  children,
}: {
  href: string
  variant?: Variant
  icon?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], className)}>
      <span>{children}</span>
      {icon}
    </Link>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
    />
  )
}
