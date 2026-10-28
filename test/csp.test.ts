import { describe, it, expect } from 'vitest'
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
