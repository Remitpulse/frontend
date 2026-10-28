import type { NextConfig } from 'next'

// WebAuthn requires a secure context; these headers keep the passkey surface tight.
// The Content-Security-Policy is generated per-request in middleware.ts so that
// script-src can use a nonce instead of 'unsafe-inline'. Keep the remaining
// security headers here.

const nextConfig: NextConfig = {
  // Next 16 keeps reactStrictMode defaulting to true, but we set it explicitly
  // so the behavior is stable across 15 → 16 upgrades.
  reactStrictMode: true,
  // Next 16 still emits the X-Powered-By header by default; keep it disabled.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Permissions-Policy',
            value:
              'publickey-credentials-get=(self), publickey-credentials-create=(self), camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
