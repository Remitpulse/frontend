import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth } from '@/components/layout/RequireAuth'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  )
}
