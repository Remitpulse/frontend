import type { Metadata } from 'next'
import { FlowHeader, FlowPage } from '@/components/layout/FlowHeader'

export const metadata: Metadata = { title: 'Help & support' }

const FAQ = [
  {
    q: 'What is a passkey?',
    a: 'A passkey replaces passwords and seed phrases. It lives in your device’s secure hardware and unlocks with Face ID, Touch ID, or your PIN. RemitPulse never sees your biometrics.',
  },
  {
    q: 'What if I lose my phone?',
    a: 'Passkeys synced through iCloud Keychain or Google Password Manager restore on your new device. You can also add a backup passkey in Settings.',
  },
  {
    q: 'What is quick send?',
    a: 'After one passkey approval, a short-lived key on this device can approve small transfers without another prompt. It expires automatically and is capped on-chain.',
  },
  {
    q: 'Why is there a partner portal?',
    a: 'Licensed partners (Stellar anchors) handle cash and bank payments in and out. Their secure page opens inside RemitPulse so you never leave the flow.',
  },
  {
    q: 'Who pays network fees?',
    a: 'RemitPulse sponsors Stellar network fees for every transfer.',
  },
]

export default function HelpPage() {
  return (
    <FlowPage>
      <FlowHeader title="Help & support" />
      <h2 className="mt-6 text-[26px] font-bold text-navy">How can we help?</h2>
      <dl className="mt-6 space-y-5">
        {FAQ.map((f) => (
          <div key={f.q} className="rounded-card border border-border bg-white p-5">
            <dt className="font-semibold text-ink">{f.q}</dt>
            <dd className="mt-2 text-body text-muted">{f.a}</dd>
          </div>
        ))}
      </dl>
    </FlowPage>
  )
}
