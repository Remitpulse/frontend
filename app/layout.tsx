import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { config } from '@/lib/config'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'RemitPulse — Money moves. Life happens.', template: '%s · RemitPulse' },
  description: 'Send money home in moments with passkey security and zero hidden fees. Powered by Stellar.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#0A192F',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {config.demoMode && (
          <div className="bg-warn-soft px-4 py-1.5 text-center text-caption text-warn">
            Demo mode · rates, fees and partner screens are sample data
          </div>
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}