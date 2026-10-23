'use client'

import { useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { Spinner } from '@/components/ui/Button'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (ready && !session) router.replace('/')
  }, [ready, session, router])

  if (!ready || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-royal">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }
  return <>{children}</>
}
