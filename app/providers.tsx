'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { TransferDraftProvider } from '@/components/providers/TransferDraftProvider'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TransferDraftProvider>{children}</TransferDraftProvider>
    </AuthProvider>
  )
}
