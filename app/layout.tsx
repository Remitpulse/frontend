import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import { config } from '@/lib/config'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'RemitPulse — Money moves. Life happens.', template: '%s · RemitPulse' },
  description: 'Send money home in moments with passkey security and zero hidden fees. Powered by Stellar.',
}

export const viewport: Viewport = {
  themeColor: '#0A192F',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="en" className={inter.variable}>
      <body>
        {config.demoMode && (
          <div className="bg-warn-soft px-4 py-1.5 text-center text-caption text-warn">
            Demo mode · rates, fees and partner screens are sample data
          </div>
        )}
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  )
}