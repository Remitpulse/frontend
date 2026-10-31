/**
 * Builds the per-request Content-Security-Policy. `script-src` uses a nonce
 * instead of `'unsafe-inline'` so inline scripts can't run XSS payloads; dev
 * additionally needs `'unsafe-eval'` for Next's dev-mode tooling.
 *
 * `connect-src` is derived from the configured backend relay origin (plus the
 * SEP-24 anchor origins), and `frame-src` from the SEP-24 anchor allowlist, so
 * cross-origin API calls and the SEP-24 iframe work in production.
 */
import { config } from './config'

/**
 * Normalizes a configured URL/origin into a CSP source expression. Returns
 * `undefined` for empty or unparseable values so they're skipped.
 */
function toCspSource(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    return url.origin
  } catch {
    return undefined
  }
}

/** Dedupes sources while preserving order, skipping undefined/empty entries. */
function uniqueSources(values: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

export function buildCsp({ nonce, dev }: { nonce: string; dev: boolean }): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, ...(dev ? ["'unsafe-eval'"] : [])].join(' ')

  const backendSource = toCspSource(config.backendUrl)
  const anchorSources = config.sep24AllowedOrigins
    .map(toCspSource)
    .filter((s): s is string => Boolean(s))

  // The backend relay may also be used for fetch calls, and anchors are
  // reachable for fetch fallbacks. frame-src is restricted to anchors only.
  const connectSrc = uniqueSources(["'self'", backendSource, ...anchorSources]).join(' ')
  const frameSrc = uniqueSources(["'self'", ...anchorSources]).join(' ')

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
