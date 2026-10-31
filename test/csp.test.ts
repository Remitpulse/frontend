import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildCsp } from '../lib/csp'

/**
 * Regression tests for issue #33:
 * CSP script-src must not allow 'unsafe-inline' (nor 'unsafe-eval' in prod).
 * A nonce-based script-src is required to preserve XSS protection.
 */

function getDirective(policy: string, name: string): string | undefined {
  return policy
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `))
}

describe('buildCsp', () => {
  describe('production policy', () => {
    const nonce = 'abc123nonce'
    const policy = buildCsp({ nonce, dev: false })

    it("does not allow 'unsafe-inline' in script-src", () => {
      const scriptSrc = getDirective(policy, 'script-src')
      expect(scriptSrc).toBeDefined()
      expect(scriptSrc).not.toContain("'unsafe-inline'")
    })

    it("does not allow 'unsafe-eval' in script-src", () => {
      const scriptSrc = getDirective(policy, 'script-src')
      expect(scriptSrc).toBeDefined()
      expect(scriptSrc).not.toContain("'unsafe-eval'")
    })

    it("contains a 'nonce-...' source in script-src", () => {
      const scriptSrc = getDirective(policy, 'script-src')
      expect(scriptSrc).toBeDefined()
      expect(scriptSrc).toContain(`'nonce-${nonce}'`)
    })

    it("still allows 'self' in script-src", () => {
      const scriptSrc = getDirective(policy, 'script-src')
      expect(scriptSrc).toBeDefined()
      expect(scriptSrc).toContain("'self'")
    })

    it("may still allow 'unsafe-inline' in style-src", () => {
      const styleSrc = getDirective(policy, 'style-src')
      expect(styleSrc).toBeDefined()
      // Lower risk than script-src; allowed for now.
      expect(styleSrc).toContain("'unsafe-inline'")
    })
  })

  describe('development policy', () => {
    const nonce = 'devnonce456'
    const policy = buildCsp({ nonce, dev: true })

    it("does not allow 'unsafe-inline' in script-src", () => {
      const scriptSrc = getDirective(policy, 'script-src')
      expect(scriptSrc).toBeDefined()
      expect(scriptSrc).not.toContain("'unsafe-inline'")
    })

    it("contains a 'nonce-...' source in script-src", () => {
      const scriptSrc = getDirective(policy, 'script-src')
      expect(scriptSrc).toBeDefined()
      expect(scriptSrc).toContain(`'nonce-${nonce}'`)
    })

    it("may allow 'unsafe-eval' in script-src for dev tooling", () => {
      const scriptSrc = getDirective(policy, 'script-src')
      expect(scriptSrc).toBeDefined()
      expect(scriptSrc).toContain("'unsafe-eval'")
    })
  })
})

/**
 * Regression tests for issue #47 (CSP connect-src / frame-src must reflect the
 * configured backend and SEP-24 origins). We re-import the config module with
 * mocked env vars so we can assert specific origins land in the policy.
 */
describe('buildCsp integration sources (issue #47)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('adds the backend URL origin to connect-src', async () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://api.remitpulse.com')
    vi.stubEnv('NEXT_PUBLIC_SEP24_ALLOWED_ORIGINS', '')
    const { buildCsp: build } = await import('../lib/csp')
    const policy = build({ nonce: 'n1', dev: false })
    const connectSrc = getDirective(policy, 'connect-src')
    expect(connectSrc).toBeDefined()
    expect(connectSrc).toContain("'self'")
    expect(connectSrc).toContain('https://api.remitpulse.com')
    vi.unstubAllEnvs()
  })

  it('adds SEP-24 allowed origins to frame-src and connect-src', async () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://api.remitpulse.com')
    vi.stubEnv(
      'NEXT_PUBLIC_SEP24_ALLOWED_ORIGINS',
      'https://anchor.example.com, https://sandbox.anchor.example.com',
    )
    const { buildCsp: build } = await import('../lib/csp')
    const policy = build({ nonce: 'n2', dev: false })
    const frameSrc = getDirective(policy, 'frame-src')
    const connectSrc = getDirective(policy, 'connect-src')
    expect(frameSrc).toBeDefined()
    expect(frameSrc).toContain("'self'")
    expect(frameSrc).toContain('https://anchor.example.com')
    expect(frameSrc).toContain('https://sandbox.anchor.example.com')
    expect(connectSrc).toContain('https://anchor.example.com')
    // Backend origin should not be allowed as a frame source.
    expect(frameSrc).not.toContain('https://api.remitpulse.com')
    vi.unstubAllEnvs()
  })

  it('does not include the backend origin in frame-src', async () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://api.remitpulse.com')
    vi.stubEnv('NEXT_PUBLIC_SEP24_ALLOWED_ORIGINS', '')
    const { buildCsp: build } = await import('../lib/csp')
    const policy = build({ nonce: 'n3', dev: false })
    const frameSrc = getDirective(policy, 'frame-src')
    expect(frameSrc).toBeDefined()
    expect(frameSrc).not.toContain('https://api.remitpulse.com')
    vi.unstubAllEnvs()
  })
})
