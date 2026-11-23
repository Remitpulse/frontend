import type { Metadata, Viewport } from 'next'
import { connection } from 'next/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'RemitPulse · Stellar Arcade',
  description: 'Five Stellar originals. Wager simulated XLM in the RemitPulse arcade.',
}
export const viewport: Viewport = { themeColor: '#0b0a13', viewportFit: 'cover' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection()
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
