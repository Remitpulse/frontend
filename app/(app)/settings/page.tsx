'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Card, Row } from '@/components/ui/Card'
import { BoltIcon, ExternalIcon, FingerprintIcon, KeyIcon } from '@/components/ui/Icons'
import { useSessionKey } from '@/hooks/useSessionKey'
import { config } from '@/lib/config'
import { shortAddress } from '@/lib/format'
import { explorerContractUrl } from '@/lib/stellar/network'
import { bytesToHex } from '@/lib/stellar/webauthn'

/** 08 · Account & passkey settings. */
export default function SettingsPage() {
  const router = useRouter()
  const { session, signOut } = useAuth()
  const sessionKey = useSessionKey()
  const [confirmLogout, setConfirmLogout] = useState(false)

  if (!session) return null
  const minutesLeft = sessionKey.record ? Math.max(0, Math.round((sessionKey.record.expiresAt - Date.now()) / 60_000)) : 0

  return (
    <main className="mx-auto max-w-flow px-6 pb-8 pt-8 lg:pt-10">
      <h1 className="text-[26px] font-bold text-navy">Account &amp; security</h1>

      <section className="mt-6" aria-labelledby="passkey-h">
        <h2 id="passkey-h" className="text-[15px] font-semibold text-ink">
          Passkey
        </h2>
        <Card className="mt-3 flex items-center gap-4 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-royal-soft text-royal">
            <FingerprintIcon />
          </span>
          <div className="flex-1">
            <p className="font-semibold text-ink">This device</p>
            <p className="text-caption text-muted">Credential {shortAddress(session.credentialId)}</p>
          </div>
          <span className="rounded-full bg-mint-soft px-3 py-1 text-xs text-mint-dark">Active</span>
        </Card>
        <p className="mt-2 text-caption text-muted">Your biometric information stays on your device. RemitPulse never receives it.</p>
      </section>

      <section className="mt-8" aria-labelledby="quick-h">
        <h2 id="quick-h" className="text-[15px] font-semibold text-ink">
          Quick send
        </h2>
        <Card className="mt-3 p-4">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint-soft text-mint-dark">
              <BoltIcon />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-ink">{sessionKey.active ? 'On' : 'Off'}</p>
              <p className="text-caption text-muted">
                {sessionKey.active
                  ? `Transfers up to $${sessionKey.record!.maxAmount} send without a prompt for ${minutesLeft} more min.`
                  : `Approve once with your passkey, then send up to $${config.sessionKey.maxAmount} without another prompt for ${config.sessionKey.ttlMinutes} minutes.`}
              </p>
            </div>
          </div>
          {sessionKey.active && sessionKey.record && (
            <p className="mt-3 break-all rounded-control bg-surface px-3 py-2 font-mono text-[11px] text-muted">
              ed25519:{bytesToHex(sessionKey.record.publicKey)}
            </p>
          )}
          <div className="mt-4">
            {sessionKey.active ? (
              <Button variant="secondary" onClick={sessionKey.revoke}>
                Turn off on this device
              </Button>
            ) : (
              <Button icon={<FingerprintIcon />} loading={sessionKey.issuing} disabled={!sessionKey.supported} onClick={() => sessionKey.issue().catch(() => {})}>
                Turn on quick send
              </Button>
            )}
          </div>
          {sessionKey.error && (
            <p className="mt-2 text-caption text-danger" role="alert">
              {sessionKey.error}
            </p>
          )}
        </Card>
      </section>

      <section className="mt-8" aria-labelledby="acct-h">
        <h2 id="acct-h" className="text-[15px] font-semibold text-ink">
          Smart account
        </h2>
        <Card className="mt-3 space-y-3 p-4">
          <Row
            label="Address"
            value={
              <a href={explorerContractUrl(session.contractId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-royal">
                {shortAddress(session.contractId)} <ExternalIcon size={14} />
              </a>
            }
          />
          <Row label="Network" value={config.network === 'mainnet' ? 'Stellar Mainnet' : 'Stellar Testnet'} />
          <Row label="Fees" value="Sponsored by RemitPulse" />
        </Card>
      </section>

      <div className="mt-8">
        {confirmLogout ? (
          <Card className="p-4">
            <p className="font-semibold text-ink">Log out of RemitPulse?</p>
            <p className="mt-1 text-caption text-muted">You can log back in any time with your passkey. Quick send will be turned off.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setConfirmLogout(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  await signOut()
                  router.replace('/')
                }}
              >
                Log out
              </Button>
            </div>
          </Card>
        ) : (
          <Button variant="secondary" icon={<KeyIcon />} onClick={() => setConfirmLogout(true)}>
            Log out
          </Button>
        )}
      </div>
    </main>
  )
}
