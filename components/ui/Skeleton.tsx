import type { CSSProperties, HTMLAttributes } from 'react'

type SkeletonRadius = 'sm' | 'md' | 'lg' | 'xl' | 'full'

const radiusClasses: Record<SkeletonRadius, string> = {
  sm: 'rounded-[12px]',
  md: 'rounded-[14px]',
  lg: 'rounded-[16px]',
  xl: 'rounded-[18px]',
  full: 'rounded-full',
}

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Corner radius token, mapped to the 12–18px design radii. */
  radius?: SkeletonRadius
  /** Optional explicit width (e.g. "60%", "12rem"). */
  width?: string | number
  /** Optional explicit height (e.g. "1rem", 48). */
  height?: string | number
}

function toCssSize(value?: string | number): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'number' ? `${value}px` : value
}

/**
 * Base skeleton block. Uses the surface token with a slate fallback and a
 * pulse animation to indicate loading content.
 */
export function Skeleton({
  radius = 'md',
  width,
  height,
  className = '',
  style,
  ...rest
}: SkeletonProps) {
  const mergedStyle: CSSProperties = {
    width: toCssSize(width),
    height: toCssSize(height),
    ...style,
  }

  return (
    <div
      aria-hidden="true"
      className={[
        'animate-pulse bg-slate-200',
        'bg-[color:var(--color-surface,#e2e8f0)]',
        radiusClasses[radius],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={mergedStyle}
      {...rest}
    />
  )
}

/** A single line of skeleton text. */
export function SkeletonText({
  lines = 1,
  className = '',
  lineClassName = '',
}: {
  lines?: number
  className?: string
  lineClassName?: string
}) {
  return (
    <div className={['flex flex-col gap-2', className].filter(Boolean).join(' ')}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          radius="sm"
          height={12}
          width={index === lines - 1 && lines > 1 ? '70%' : '100%'}
          className={lineClassName}
        />
      ))}
    </div>
  )
}

/** Circular skeleton, useful for avatars and icons. */
export function SkeletonCircle({
  size = 40,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <Skeleton
      radius="full"
      width={size}
      height={size}
      className={['shrink-0', className].filter(Boolean).join(' ')}
    />
  )
}

/** Card container mirroring the app's surface cards. */
export function SkeletonCard({
  className = '',
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={[
        'rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm',
        'border-[color:var(--color-border,#e2e8f0)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

/** Header block with a title line and optional subtitle. */
export function SkeletonHeader({ className = '' }: { className?: string }) {
  return (
    <div className={['flex flex-col gap-3', className].filter(Boolean).join(' ')}>
      <Skeleton radius="sm" height={24} width="40%" />
      <Skeleton radius="sm" height={14} width="60%" />
    </div>
  )
}

/** Balance / stat card skeleton for dashboard and wallet routes. */
export function SkeletonBalanceCard({ className = '' }: { className?: string }) {
  return (
    <SkeletonCard className={className}>
      <div className="flex flex-col gap-3">
        <Skeleton radius="sm" height={12} width="35%" />
        <Skeleton radius="md" height={36} width="55%" />
        <div className="flex gap-2 pt-2">
          <Skeleton radius="full" height={32} width={96} />
          <Skeleton radius="full" height={32} width={96} />
        </div>
      </div>
    </SkeletonCard>
  )
}

/** A single list-row skeleton (transfers, recipients, activity). */
export function SkeletonRow({ className = '' }: { className?: string }) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-[14px] border border-slate-200 bg-white p-3',
        'border-[color:var(--color-border,#e2e8f0)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <SkeletonCircle size={40} />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton radius="sm" height={14} width="45%" />
        <Skeleton radius="sm" height={12} width="30%" />
      </div>
      <Skeleton radius="sm" height={16} width={64} />
    </div>
  )
}

/** Repeated list of row skeletons. */
export function SkeletonList({
  count = 5,
  className = '',
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={['flex flex-col gap-3', className].filter(Boolean).join(' ')}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  )
}

/** Grid of stat cards for dashboard-style layouts. */
export function SkeletonStatGrid({
  count = 3,
  className = '',
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={['grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3', className]
        .filter(Boolean)
        .join(' ')}
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index}>
          <div className="flex flex-col gap-3">
            <Skeleton radius="sm" height={12} width="50%" />
            <Skeleton radius="md" height={28} width="65%" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  )
}

export default Skeleton
