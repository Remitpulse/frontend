'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  ArrowRightIcon,
  BankIcon,
  CashIcon,
  CheckCircleIcon,
  ClockIcon,
  ExternalIcon,
  ShieldIcon,
  XIcon,
} from '@/components/ui/Icons'
import { Tag } from '@/components/ui/StatusPill'
import { api, ApiError } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { config } from '@/lib/config'

/** SEP-24 statuses after which the user's part of the interactive flow is done. */
const USER_DONE = new Set([
  'pending_user_transfer_complete',
  'pending_anchor',
  'pending_stellar',
  'pending_external',
  'pending_trust',
  'completed',
])
const FAILED = new Set(['error', 'expired', 'refunded', 'no_market', 'too_small', 'too_large'])
const POLL_MS = 3_000
/** SEP-24 endpoints may be slower than the default API timeout. */
const SEP24_TIMEOUT_MS = 30_000
/** Consecutive timeouts before we tell the user the anchor is slow. */
const SLOW_AFTER_TIMEOUTS = 2

/**
 * Sandbox for the anchor's interactive flow.
 *
 * Deliberately does NOT include `allow-same-origin`: combined with
 * `allow-scripts` it lets the framed document script its own origin and strip
 * its sandbox. Anchors are third-party partners, so we treat their content as
 * untrusted. The opaque origin still permits scripts, forms, and popups;
 * completion is reported via cross-origin `postMessage` and backend polling,
 * neither of which needs same-origin access. If an anchor ever requires its own
 * cookies/localStorage, it must be escalated explicitly as accepted risk.
 */
const IFRAME_SANDBOX =
  'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox'

/**
 * Window features for the SEP-24 popup fallback.
 *
 * `noopener` and `noreferrer` are both required: without them the third-party
 * anchor retains a `window.opener` handle and can navigate the RemitPulse tab
 * to a phishing lookalike while the user is distracted by the popup (reverse
 * tabnabbing). Because `noopener` causes `window.open` to return `null`, we
 * track the popup with a boolean and rely on the SEP-24 `postMessage`
 * callback + backend polling for completion, never on a `Window` handle.
 */
const POPUP_FEATURES = 'popup,width=480,height=760,noopener,noreferrer'

export interface Sep24ModalProps {
  open: boolean
  kind: 'deposit' | 'withdraw'
  sep24Id: string
  /** Interactive URL from the anchor (via backend). Null in demo mode. */
  url: string | null
  anchorName: string
  /** Transfer being funded; used for demo completion. */
  transferId?: string
  summary: { amount: string; counterparty: string }
  onComplete: () => void
  onClose: () => void
}

function isAllowedOrigin(url: string) {
  try {
    return config.sep24AllowedOrigins.includes(new URL(url).origin)
  } catch {
    return false
  }
}

/**
 * 05 · Secure partner funding gateway.
 *
 * Renders the anchor's SEP-24 interactive flow in a sandboxed iframe (or a
 * popup when the anchor forbids framing). Completion is detected from the
 * anchor's `postMessage` callback *and* by polling the backend, since not all
 * anchors implement the callback.
 */
export function Sep24Modal(props: Sep24ModalProps) {
  const { open, url, sep24Id, onComplete, onClose } = props
  const [status, setStatus] = useState<string>('incomplete')
  // A boolean, not a `Window` handle: with `noopener` the popup is opaque to
  // us by design, so we cannot focus or close it programmatically.
  const [popupOpened, setPopupOpened] = useState(false)
  const [slow, setSlow] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const completed = useRef(false)

  const allowed = !url || isAllowedOrigin(url)

  const finish = useCallback(() => {
    if (completed.current) return
    completed.current = true
    onComplete()
  }, [onComplete])

  const handleStatus = useCallback(
    (s: string) => {
      setStatus(s)
      if (USER_DONE.has(s)) finish()
    },
    [finish],
  )

  // Anchor postMessage callback (SEP-24 `callback=postMessage`).
  useEffect(() => {
    if (!open || !url) return
    const anchorOrigin = new URL(url).origin
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== anchorOrigin) return
      const tx = (e.data as { transaction?: { status?: string } } | null)?.transaction
      if (tx?.status) handleStatus(tx.status)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [open, url, handleStatus])

  // Backend polling fallback.
  useEffect(() => {
    if (!open || !url) return
    let t: ReturnType<typeof setTimeout>
    let timeouts = 0
    const tick = async () => {
      try {
        const s = await api.getSep24Status(sep24Id, { timeoutMs: SEP24_TIMEOUT_MS })
        timeouts = 0
        setSlow(false)
        handleStatus(s.status)
      } catch (err) {
        if (err instanceof ApiError && err.code === 'timeout') {
          timeouts += 1
          if (timeouts >= SLOW_AFTER_TIMEOUTS) setSlow(true)
        }
        /* transient; keep polling */
      }
      if (!completed.current) t = setTimeout(tick, POLL_MS)
    }
    t = setTimeout(tick, POLL_MS)
    return () => clearTimeout(t)
  }, [open, url, sep24Id, handleStatus])

  useEffect(() => {
    if (!open) return
    completed.current = false
    setSlow(false)
    setPopupOpened(false)
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const openPopup = () => {
    if (!url) return
    // Return value is `null` with `noopener`; we just record that we tried.
    window.open(url, 'remitpulse-sep24', POPUP_FEATURES)
    setPopupOpened(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/60 sm:items-center"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sep24-title"
        className="flex h-[100dvh] w-full max-w-flow flex-col overflow-hidden bg-surface sm:h-[min(860px,92dvh)] sm:rounded-card"
      >
        <header className="flex items-center gap-3 border-b border-border bg-white px-6 py-4">
          <ShieldIcon className="text-mint-dark" size={24} />
          <div className="flex-1">
            <h2 id="sep24-title" className="text-[17px] font-semibold text-ink">
              Secure partner portal
            </h2>
            <p className="text-caption text-muted">{props.anchorName}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-ink"
            aria-label="Close partner portal"
          >
            <XIcon size={22} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="rounded-control bg-royal-soft px-4 py-3">
            <p className="text-body font-semibold text-royal">
              {props.kind === 'deposit' ? 'Funding your transfer' : 'Cashing out'}
            </p>
            <p className="mt-1 flex items-center gap-2 text-[13px] text-ink">
              {props.summary.amount} <ArrowRightIcon size={14} /> {props.summary.counterparty}
            </p>
          </div>

          <div className="mt-4">
            {!allowed ? (
              <div
                className="rounded-card border border-danger bg-danger-soft p-5 text-body text-danger"
                role="alert"
              >
                This partner address isn’t on RemitPulse’s approved list, so we didn’t open it.
                Contact support.
              </div>
            ) : url ? (
              popupOpened ? (
                <PopupWaiting />
              ) : (
                <div className="overflow-hidden rounded-card border border-border bg-white">
                  <iframe
                    src={url}
                    title={`${props.anchorName} secure portal`}
                    className="h-[560px] w-full"
                    sandbox={IFRAME_SANDBOX}
                    allow="camera; publickey-credentials-get"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    onClick={openPopup}
                    className="flex w-full items-center justify-center gap-2 border-t border-border py-3 text-[13px] font-medium text-royal"
                  >
                    Having trouble? Open in a new window <ExternalIcon size={14} />
                  </button>
                </div>
              )
            ) : (
              <DemoPartnerPortal
                anchorName={props.anchorName}
                onContinue={async () => {
                  if (props.transferId) {
                    await api.completeDemoFunding(props.transferId, { timeoutMs: SEP24_TIMEOUT_MS })
                  }
                  handleStatus('pending_anchor')
                }}
              />
            )}
          </div>

          <div className="mt-6 flex items-start gap-3" aria-live="polite">
            <ClockIcon className="mt-0.5 shrink-0 text-royal" />
            <div>
              <p className="text-body font-semibold text-ink">
                {FAILED.has(status) ? 'Funding didn’t complete' : 'Waiting for funding'}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                {FAILED.has(status)
                  ? 'Nothing was charged. Close this window to try again or pay from your wallet.'
                  : 'Your transfer updates automatically after payment.'}
              </p>
              {slow && !FAILED.has(status) && (
                <p className="mt-1 text-caption text-muted" role="status">
                  Still waiting on the anchor… this is taking longer than usual.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Shown while the anchor completes in a separate popup window.
 *
 * We open the popup with `noopener,noreferrer` (reverse-tabnabbing defence),
 * so the browser hands us back `null` and we cannot call `focus()` or
 * `close()` on it. Completion still arrives automatically via the SEP-24
 * `postMessage` callback or backend polling, so no handle is needed.
 */
function PopupWaiting() {
  return (
    <div className="rounded-card border border-border bg-white p-6 text-center">
      <p className="text-lg font-semibold text-ink">Connecting securely…</p>
      <p className="mt-2 text-body text-muted">
        We opened your partner portal in a new window. Keep this window open and finish
        funding there — switching back here isn’t required for your transfer to update.
      </p>
    </div>
  )
}

/** Mirrors the Figma partner screen; production loads the anchor’s real SEP-24 portal. */
function DemoPartnerPortal({
  anchorName,
  onContinue,
}: {
  anchorName: string
  onContinue: () => Promise<void>
}) {
  const [method, setMethod] = useState<'bank' | 'cash'>('bank')
  const [busy, setBusy] = useState(false)
  return (
    <div className="rounded-card border border-border bg-white p-5">
      <Tag tone="mint">Secure connection</Tag>
      <p className="mt-4 text-[26px] font-bold text-navy">{anchorName}</p>
      <p className="mt-2 text-xl font-semibold text-ink">Add money to your transfer</p>
      <p className="mt-2 text-[13px] text-muted">
        Complete funding with our partner to get your transfer moving.
      </p>
      <div className="mt-5 space-y-3" role="radiogroup" aria-label="Funding method">
        {(
          [
            {
              id: 'bank',
              icon: <BankIcon />,
              title: 'Bank account',
              detail: 'Secure bank connection',
            },
            {
              id: 'cash',
              icon: <CashIcon />,
              title: 'Cash at a location',
              detail: `Find a nearby ${anchorName} agent`,
            },
          ] as const
        ).map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={method === o.id}
            onClick={() => setMethod(o.id)}
            className={cn(
              'flex w-full items-center gap-4 rounded-control border p-4 text-left',
              method === o.id ? 'border-royal bg-royal-soft' : 'border-border',
            )}
          >
            <span className={method === o.id ? 'text-royal' : 'text-muted'}>{o.icon}</span>
            <span className="flex-1">
              <span className="block text-body font-semibold text-ink">{o.title}</span>
              <span className="block text-caption text-muted">{o.detail}</span>
            </span>
            {method === o.id && <CheckCircleIcon className="text-royal" />}
          </button>
        ))}
      </div>
      <Button
        className="mt-5"
        icon={<ArrowRightIcon />}
        loading={busy}
        onClick={async () => {
          setBusy(true)
          await onContinue()
        }}
      >
        Continue with partner
      </Button>
      <p className="mt-3 text-caption text-muted">
        Partner identity checks may be required. Demo content shown.
      </p>
    </div>
  )
}
