import type { Metadata } from 'next'
import { FlowHeader, FlowPage } from '@/components/layout/FlowHeader'

export const metadata: Metadata = { title: 'Terms & privacy' }

export default function LegalPage() {
  return (
    <FlowPage>
      <FlowHeader title="Terms & privacy" />
      <div className="mt-6 space-y-4 text-body text-muted">
        <p>
          RemitPulse is a non-custodial interface to a passkey-secured smart account on the Stellar network. Your funds are
          held by your smart account contract and can only move with your passkey or a session key you approved.
        </p>
        <p>
          Deposits, withdrawals and payouts are provided by licensed partners (Stellar anchors), who may require identity
          verification under their own terms.
        </p>
        <p className="text-caption">Replace this page with your reviewed legal copy before launch.</p>
      </div>
    </FlowPage>
  )
}
