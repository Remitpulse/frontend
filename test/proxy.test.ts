import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '../proxy'

describe('CSP nonce forwarding', () => {
  it('overwrites incoming policy and forwards the response policy to rendering', () => {
    const request = new NextRequest('https://example.org', {
      headers: { 'Content-Security-Policy': "script-src 'unsafe-inline'" },
    })
    const response = proxy(request)
    const policy = response.headers.get('Content-Security-Policy')
    expect(policy).toContain("'nonce-")
    expect(policy).not.toContain("'unsafe-inline'; script-src")
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(policy)
    const nonce = response.headers.get('x-middleware-request-x-nonce')
    expect(nonce).toBeTruthy()
    expect(policy).toContain(`'nonce-${nonce}'`)
  })
})
