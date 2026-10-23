import type { NextConfig } from 'next'

const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''
const anchorOrigins = (process.env.NEXT_PUBLIC_SEP24_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)

// WebAuthn requires a secure context; these headers keep the passkey surface tight.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${backend} https://*.stellar.org${process.env.NODE_ENV === 'development' ? ' ws: wss:' : ''}`.trim(),
  `frame-src 'self' ${anchorOrigins.join(' ')}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'publickey-credentials-get=(self), publickey-credentials-create=(self), camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
