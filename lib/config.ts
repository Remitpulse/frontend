import { Networks } from '@stellar/stellar-sdk'

export type StellarNetwork = 'testnet' | 'mainnet'
export type AssetCode = 'USDC' | 'EURC' | 'ARST' | 'BRLA'

// NEXT_PUBLIC_* values are inlined at build time, so each must be referenced literally.
const env = {
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
  rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
  explorerUrl: process.env.NEXT_PUBLIC_STELLAR_EXPLORER_URL,
  accountContractId: process.env.NEXT_PUBLIC_ACCOUNT_CONTRACT_ID,
  subsidyContractId: process.env.NEXT_PUBLIC_SUBSIDY_CONTRACT_ID,
  usdc: process.env.NEXT_PUBLIC_USDC_CONTRACT_ID,
  eurc: process.env.NEXT_PUBLIC_EURC_CONTRACT_ID,
  arst: process.env.NEXT_PUBLIC_ARST_CONTRACT_ID,
  brla: process.env.NEXT_PUBLIC_BRLA_CONTRACT_ID,
  rpId: process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID,
  rpName: process.env.NEXT_PUBLIC_WEBAUTHN_RP_NAME,
  appOrigin: process.env.NEXT_PUBLIC_APP_ORIGIN,
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL,
  sep24Origins: process.env.NEXT_PUBLIC_SEP24_ALLOWED_ORIGINS,
  sessionMax: process.env.NEXT_PUBLIC_SESSION_KEY_MAX_AMOUNT,
  sessionTtl: process.env.NEXT_PUBLIC_SESSION_KEY_TTL_MINUTES,
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE,
  apiTimeoutMs: process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
}

const network: StellarNetwork = env.network === 'mainnet' ? 'mainnet' : 'testnet'

/** Parses a positive numeric env value, falling back to `fallback` when unset/invalid. */
function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const NETWORK_DEFAULTS = {
  testnet: {
    passphrase: Networks.TESTNET,
    rpcUrl: 'https://soroban-testnet.stellar.org',
    explorerUrl: 'https://stellar.expert/explorer/testnet',
  },
  mainnet: {
    passphrase: Networks.PUBLIC,
    // There is no SDF-hosted public mainnet RPC; set NEXT_PUBLIC_STELLAR_RPC_URL.
    rpcUrl: '',
    explorerUrl: 'https://stellar.expert/explorer/public',
  },
} as const

export const config = {
  network,
  networkPassphrase: NETWORK_DEFAULTS[network].passphrase,
  rpcUrl: env.rpcUrl || NETWORK_DEFAULTS[network].rpcUrl,
  explorerUrl: env.explorerUrl || NETWORK_DEFAULTS[network].explorerUrl,
  contracts: {
    account: env.accountContractId ?? '',
    subsidy: env.subsidyContractId ?? '',
  },
  assets: {
    USDC: env.usdc ?? '',
    EURC: env.eurc ?? '',
    ARST: env.arst ?? '',
    BRLA: env.brla ?? '',
  } satisfies Record<AssetCode, string>,
  webauthn: {
    rpId: env.rpId || (typeof window !== 'undefined' ? window.location.hostname : 'localhost'),
    rpName: env.rpName || 'RemitPulse',
    origin: env.appOrigin ?? '',
  },
  backendUrl: (env.backendUrl ?? '').replace(/\/$/, ''),
  sep24AllowedOrigins: (env.sep24Origins ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  sessionKey: {
    maxAmount: Number(env.sessionMax ?? 50),
    ttlMinutes: Number(env.sessionTtl ?? 30),
  },
  demoMode: env.demoMode === 'true',
  /** Default request timeout for backend API calls (ms). */
  apiTimeoutMs: positiveNumber(env.apiTimeoutMs, 20_000),
  /** Longer timeout for slow endpoints such as SEP-24 and relay calls (ms). */
  apiSlowTimeoutMs: positiveNumber(env.apiTimeoutMs, 20_000) * 2.25,
} as const

/** Fails fast in production when a required integration value is missing. */
export function assertConfig() {
  if (config.demoMode) return
  const missing = Object.entries({
    NEXT_PUBLIC_STELLAR_RPC_URL: config.rpcUrl,
    NEXT_PUBLIC_ACCOUNT_CONTRACT_ID: config.contracts.account,
    NEXT_PUBLIC_SUBSIDY_CONTRACT_ID: config.contracts.subsidy,
    NEXT_PUBLIC_USDC_CONTRACT_ID: config.assets.USDC,
    NEXT_PUBLIC_BACKEND_URL: config.backendUrl,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length) throw new Error(`Missing RemitPulse configuration: ${missing.join(', ')}`)
}
