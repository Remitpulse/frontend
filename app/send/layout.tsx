import { RequireAuth } from '@/components/layout/RequireAuth'

export default function SendLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}
