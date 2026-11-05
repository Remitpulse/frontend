// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sep24Modal } from '../components/Sep24Modal'

vi.mock('@/lib/config', () => ({
  config: { demoMode: false, sep24AllowedOrigins: ['https://anchor.example'] },
}))
vi.mock('@/lib/api/client', () => ({ api: {}, ApiError: class extends Error {} }))
afterEach(cleanup)

describe('live SEP-24 portal', () => {
  it.each([null, 'not a URL', 'https://unapproved.example'])(
    'rejects missing or invalid anchor URL %s without showing demo funding',
    (url) => {
      render(
        <Sep24Modal
          open
          kind="deposit"
          sep24Id="test"
          url={url}
          anchorName="Anchor"
          summary={{ amount: '10', counterparty: 'Recipient' }}
          onComplete={vi.fn()}
          onClose={vi.fn()}
        />,
      )
      expect(screen.getByRole('alert').textContent).toContain('approved list')
      expect(screen.queryByText('Continue with partner')).toBeNull()
      expect(document.querySelector('iframe')).toBeNull()
    },
  )
})
