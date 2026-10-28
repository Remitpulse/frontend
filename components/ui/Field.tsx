import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const control =
  'h-[52px] w-full rounded-control border bg-white px-4 text-[15px] text-ink placeholder:text-slate-400 focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20'

interface FieldShellProps {
  label: string
  hint?: ReactNode
  error?: string
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

function FieldShell({ label, hint, error, children }: FieldShellProps) {
  const id = useId()
  const msgId = `${id}-msg`
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-body font-medium text-ink">
        {label}
      </label>
      {children({ id, describedBy: error || hint ? msgId : undefined, invalid: !!error })}
      {error ? (
        <p id={msgId} className="text-caption text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function TextField({
  label,
  hint,
  error,
  prefix,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: ReactNode
  error?: string
  prefix?: string
}) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {prefix && (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-ink">
              {prefix}
            </span>
          )}
          <input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className={cn(
              control,
              invalid ? 'border-danger' : 'border-border',
              prefix && 'pl-14',
              className,
            )}
            {...props}
          />
        </div>
      )}
    </FieldShell>
  )
}

export function SelectField({
  label,
  hint,
  error,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode; error?: string }) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={cn(
            control,
            'appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2720%27 height=%2720%27 fill=%27none%27 stroke=%27%2364748B%27 stroke-width=%272%27 viewBox=%270 0 24 24%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[right_1rem_center] bg-no-repeat pr-10',
            invalid ? 'border-danger' : 'border-border',
            className,
          )}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  )
}
