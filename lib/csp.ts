/**
 * Builds the per-request Content-Security-Policy. `script-src` uses a nonce
 * instead of `'unsafe-inline'` so inline scripts can't run XSS payloads; dev
 * additionally needs `'unsafe-eval'` for Next's dev-mode tooling.
 */
export function buildCsp({ nonce, dev }: { nonce: string; dev: boolean }): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, ...(dev ? ["'unsafe-eval'"] : [])].join(' ')

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "connect-src 'self'",
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
