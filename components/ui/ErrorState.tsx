import { AlertIcon } from './Icons'

export function ErrorState({ message, onRetry }: { message?: string | null; onRetry: () => void }) {
  return (
    <div className="mt-4 rounded-card border border-danger bg-danger-soft p-5" role="alert">
      <div className="flex items-center gap-2 text-danger">
        <AlertIcon size={18} />
        <p className="text-body font-semibold">Couldn’t load this</p>
      </div>
      <p className="mt-1 text-[13px] text-danger">
        {message ?? 'Check your connection and try again.'}
      </p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-control border border-border bg-white px-4 text-[13px] font-semibold text-ink hover:bg-surface"
      >
        Try again
      </button>
    </div>
  )
}
