'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/layout/Logo'
import { useAuth } from '@/components/providers/AuthProvider'
import { Button } from '@/components/ui/Button'
import {
  ArrowRightIcon,
  FingerprintIcon,
  GlobeIcon,
  HelpIcon,
  ShieldIcon,
} from '@/components/ui/Icons'
import { Tag } from '@/components/ui/StatusPill'
import { usePasskey } from '@/hooks/usePasskey'

/** 01 · Welcome & passkey onboarding — with M04 "Couldn’t verify your passkey" recovery. */
export default function WelcomePage() {
  const router = useRouter()
  const { session, ready } = useAuth()
  const passkey = usePasskey()
  const [action, setAction] = useState<'register' | 'login' | null>(null)

  useEffect(() => {
    if (ready && session) router.replace('/dashboard')
  }, [ready, session, router])

  const run = async (kind: 'register' | 'login') => {
    setAction(kind)
    try {
      if (kind === 'register') await passkey.register('RemitPulse account')
      else await passkey.login()
      router.push('/dashboard')
    } catch {
      // Error copy is surfaced via passkey.error.
    }
  }

  if (passkey.status === 'error' && passkey.error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-flow flex-col px-6 pb-10 pt-16">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-danger-soft text-danger">
          <HelpIcon size={30} />
        </div>
        <h1 className="mt-10 text-[28px] font-bold leading-tight text-navy">
          Let’s try that again.
        </h1>
        <p className="mt-6 text-body text-muted" role="alert">
          {passkey.error} Your account is safe.
        </p>
        <div className="mt-auto space-y-3 pt-10">
          <Button icon={<FingerprintIcon />} onClick={() => run(action ?? 'login')}>
            Try passkey again
          </Button>
          <Button variant="secondary" icon={<HelpIcon />} onClick={passkey.clearError}>
            Back to sign in
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-2">
      <section className="relative overflow-hidden bg-navy px-6 pb-12 pt-6 text-white lg:flex lg:flex-col lg:justify-center lg:px-16">
        <Logo inverted />
        <div className="mt-8">
          <Tag tone="navy">Borderless by design</Tag>
        </div>
        <h1 className="mt-5 text-[36px] font-bold leading-[1.2] tracking-tight lg:text-5xl">
          Closer to home.
          <br />
          In every transfer.
        </h1>
        <p className="mt-4 max-w-sm text-[15px] text-slate-300">
          Send money worldwide in moments, with zero hidden fees.
        </p>
        <HeroIllustration />
      </section>

      <section className="mx-auto w-full max-w-flow px-6 pb-8 pt-7 lg:flex lg:flex-col lg:justify-center">
        <h2 className="text-[22px] font-bold text-navy">Your account. Your fingerprint.</h2>
        <p className="mt-2 text-body text-muted">
          Sign up securely with Face ID, Touch ID, or your device PIN. No passwords or seed phrases
          to remember.
        </p>
        <div className="mt-6 space-y-3">
          <Button
            icon={<FingerprintIcon />}
            loading={passkey.isBusy && action === 'register'}
            disabled={passkey.isBusy}
            onClick={() => run('register')}
          >
            Create account with passkey
          </Button>
          <Button
            variant="secondary"
            loading={passkey.isBusy && action === 'login'}
            disabled={passkey.isBusy}
            onClick={() => run('login')}
          >
            Log in with passkey
          </Button>
        </div>
        {passkey.status === 'verifying' && (
          <p className="mt-3 text-center text-caption text-muted" aria-live="polite">
            {action === 'register' ? 'Securing your account…' : 'Checking your passkey…'}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-10 text-[13px] text-muted">
          <span className="inline-flex items-center gap-2">
            <ShieldIcon size={18} className="text-mint-dark" /> Biometric security
          </span>
          <span className="inline-flex items-center gap-2">
            <GlobeIcon size={18} className="text-mint-dark" /> Powered by Stellar
          </span>
        </div>
        <p className="mt-6 text-caption text-muted">
          By continuing, you agree to our{' '}
          <Link href="/legal" className="underline">
            Terms &amp; Privacy Policy
          </Link>
          .
        </p>
      </section>
    </main>
  )
}

function HeroIllustration() {
  return (
    <div className="relative mx-auto mt-10 h-[200px] w-full max-w-[340px]" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/5" />
      <div className="absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
      <div className="absolute left-0 top-2 rounded-card bg-white px-4 py-3 text-navy shadow-lg">
        <p className="text-[11px] font-semibold text-muted">US</p>
        <p className="text-2xl font-bold">$500</p>
      </div>
      <div className="absolute left-1/2 top-[54px] flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-mint text-navy">
        <ArrowRightIcon />
      </div>
      <div className="absolute right-0 top-[64px] rounded-card bg-royal px-4 py-3 shadow-lg">
        <p className="text-[11px] font-semibold text-sky-100">MX</p>
        <p className="text-2xl font-bold">$8,558</p>
      </div>
      <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-mint/20 px-3 py-1 text-xs text-mint">
        &lt; 1 minute
      </span>
    </div>
  )
}
