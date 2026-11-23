'use client'

import { useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import type { Result } from './Arcade'

export function Passkeys({
  active,
  act,
}: {
  active?: boolean
  act: (input: Record<string, unknown>) => Promise<Result>
}) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)

  async function verify(mode: 'register' | 'login') {
    setStatus('')
    setFailed(false)
    setBusy(true)
    try {
      if (!window.PublicKeyCredential)
        throw new Error('Use a browser with passkey support and a secure connection.')
      const { options } = await act({ action: 'passkey-' + mode + '-options' })
      const credential =
        mode === 'register'
          ? await startRegistration({
              optionsJSON: options as PublicKeyCredentialCreationOptionsJSON,
            })
          : await startAuthentication({
              optionsJSON: options as PublicKeyCredentialRequestOptionsJSON,
            })
      const result = await act({ action: 'passkey-' + mode + '-finish', credential })
      setStatus(result.message || 'Passkey verified.')
    } catch (error) {
      setFailed(true)
      setStatus((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="account-security">
      <h2>Account security</h2>
      <p>
        {active
          ? 'This account has a passkey.'
          : 'Save a passkey to recover your arcade account on this site.'}
      </p>
      <div>
        {!active && (
          <button className="button outlined" disabled={busy} onClick={() => verify('register')}>
            <Fingerprint size={17} /> Add passkey
          </button>
        )}
        <button className="button outlined" disabled={busy} onClick={() => verify('login')}>
          Sign in with a passkey
        </button>
      </div>
      {status && (
        <p className={failed ? 'error-text' : ''} role={failed ? 'alert' : 'status'}>
          {status}
        </p>
      )}
    </div>
  )
}
