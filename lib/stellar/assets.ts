import { config, type AssetCode } from '@/lib/config'

/** Stellar Asset Contract tokens use 7 decimals. */
export const TOKEN_DECIMALS = 7

export type SendCurrency = 'USD' | 'EUR'
export type ReceiveCurrency = 'MXN' | 'ARS' | 'BRL' | 'EUR'

export interface StablecoinMeta {
  code: AssetCode
  name: string
  issuerLabel: string
  fiat: string
}

export const STABLECOINS: Record<AssetCode, StablecoinMeta> = {
  USDC: { code: 'USDC', name: 'USD Coin', issuerLabel: 'Circle', fiat: 'USD' },
  EURC: { code: 'EURC', name: 'Euro Coin', issuerLabel: 'Circle', fiat: 'EUR' },
  ARST: { code: 'ARST', name: 'Argentine Peso Token', issuerLabel: 'Anclap', fiat: 'ARS' },
  BRLA: { code: 'BRLA', name: 'Brazilian Real Token', issuerLabel: 'BRLA Digital', fiat: 'BRL' },
}

export interface SendOption {
  currency: SendCurrency
  country: string
  asset: AssetCode
}

export interface Corridor {
  currency: ReceiveCurrency
  country: string
  countryName: string
  /** Stablecoin the payout anchor settles in on Stellar. */
  settlementAsset: AssetCode
  payoutMethods: Array<'bank' | 'cash'>
  bankNetwork: string
  available: boolean
}

export const SEND_OPTIONS: SendOption[] = [
  { currency: 'USD', country: 'US', asset: 'USDC' },
  { currency: 'EUR', country: 'EU', asset: 'EURC' },
]

// Launch corridor is USD → MXN (Figma scope note); BRL/ARS ride on BRLA/ARST.
export const CORRIDORS: Corridor[] = [
  { currency: 'MXN', country: 'MX', countryName: 'Mexico', settlementAsset: 'USDC', payoutMethods: ['bank', 'cash'], bankNetwork: 'SPEI', available: true },
  { currency: 'BRL', country: 'BR', countryName: 'Brazil', settlementAsset: 'BRLA', payoutMethods: ['bank'], bankNetwork: 'PIX', available: true },
  { currency: 'ARS', country: 'AR', countryName: 'Argentina', settlementAsset: 'ARST', payoutMethods: ['bank'], bankNetwork: 'CVU', available: true },
  { currency: 'EUR', country: 'EU', countryName: 'Eurozone', settlementAsset: 'EURC', payoutMethods: ['bank'], bankNetwork: 'SEPA', available: true },
]

export function assetContractId(code: AssetCode): string {
  const id = config.assets[code]
  if (!id && !config.demoMode) throw new Error(`NEXT_PUBLIC_${code}_CONTRACT_ID is not configured`)
  return id
}

/** Converts a decimal string to i128 base units without floating-point loss. */
export function toBaseUnits(amount: string, decimals = TOKEN_DECIMALS): bigint {
  const [whole = '0', frac = ''] = amount.trim().split('.')
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(frac)) throw new Error(`Invalid amount: ${amount}`)
  return BigInt(whole + frac.padEnd(decimals, '0').slice(0, decimals))
}

export function fromBaseUnits(value: bigint, decimals = TOKEN_DECIMALS): string {
  const neg = value < 0n
  const s = (neg ? -value : value).toString().padStart(decimals + 1, '0')
  const out = `${s.slice(0, -decimals)}.${s.slice(-decimals)}`.replace(/\.?0+$/, '')
  return (neg ? '-' : '') + out
}
