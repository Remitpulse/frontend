import { StrKey, hash } from '@stellar/stellar-sdk'
import { config } from '@/lib/config'
import { CORRIDORS, SEND_OPTIONS, type ReceiveCurrency, type SendCurrency } from '@/lib/stellar/assets'
import { bytesToBase64Url, base64UrlToBytes, extractP256PublicKey } from '@/lib/stellar/webauthn'
import type { Api } from './client'
import type { CreateTransferRequest, Quote, Recipient, TransferStage, TransferStatus, TransferSummary } from './types'

/**
 * Demo backend used when NEXT_PUBLIC_DEMO_MODE=true. Passkey ceremonies still run
 * against the real platform authenticator; everything server-side is simulated.
 * Rates, fees and references are sample values (see Figma handoff notes).
 */

export const SAMPLE_RATES: Record<SendCurrency, Record<ReceiveCurrency, number>> = {
  USD: { MXN: 17.15, BRL: 5.42, ARS: 1012.5, EUR: 0.92 },
  EUR: { MXN: 18.64, BRL: 5.89, ARS: 1100.4, EUR: 1 },
}
export const PARTNER_FEE = 1

export const STAGE_SECONDS = { received: 0, converted: 5, settling: 10, delivered: 18 }

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const randomChallenge = () => bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))

export interface StoredTransfer {
  req: CreateTransferRequest
  quote: Quote
  createdAt: number
  fundedAt: number | null
  reference: string
}

export const store = {
  read(): Record<string, StoredTransfer> {
    try {
      return JSON.parse(sessionStorage.getItem('rp-demo-transfers') ?? '{}')
    } catch {
      return {}
    }
  },
  write(v: Record<string, StoredTransfer>) {
    sessionStorage.setItem('rp-demo-transfers', JSON.stringify(v))
  },
}
export const quotes = new Map<string, Quote>()

export function buildQuote(sendAmount: string, sendCurrency: SendCurrency, receiveCurrency: ReceiveCurrency): Quote {
  const amount = Math.max(0, Number(sendAmount) || 0)
  const rate = SAMPLE_RATES[sendCurrency][receiveCurrency]
  const converted = Math.max(0, amount - PARTNER_FEE)
  const corridor = CORRIDORS.find((c) => c.currency === receiveCurrency)!
  const q: Quote = {
    id: `q_${crypto.randomUUID()}`,
    sendAmount: amount.toFixed(2),
    sendCurrency,
    sendAsset: SEND_OPTIONS.find((o) => o.currency === sendCurrency)!.asset,
    receiveAmount: (converted * rate).toFixed(2),
    receiveCurrency,
    settlementAsset: corridor.settlementAsset,
    rate: rate.toString(),
    fees: { platform: '0.00', partner: PARTNER_FEE.toFixed(2), network: '0.00' },
    amountConverted: converted.toFixed(2),
    totalCost: amount.toFixed(2),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    deliveryEstimate: receiveCurrency === 'MXN' ? 'Under 1 minute' : 'Within minutes',
    payTo: StrKey.encodeContract(hash(new TextEncoder().encode(`payout-${receiveCurrency}`))),
  }
  quotes.set(q.id, q)
  return q
}

export function statusFor(id: string, t: StoredTransfer): TransferStatus {
  const stageTimes: TransferStatus['stageTimes'] = { funding: new Date(t.createdAt).toISOString() }
  let stage: TransferStage = 'funding'
  if (t.fundedAt) {
    const elapsed = (Date.now() - t.fundedAt) / 1000
    for (const s of ['received', 'converted', 'settling', 'delivered'] as const) {
      if (elapsed < STAGE_SECONDS[s]) break
      stage = s
      stageTimes[s] = new Date(t.fundedAt + STAGE_SECONDS[s] * 1000).toISOString()
    }
  }
  const r = t.req.recipient
  const delivered = stage === 'delivered'
  return {
    id,
    reference: t.reference,
    state: stage === 'funding' ? 'awaiting_funding' : delivered ? 'completed' : 'in_progress',
    stage,
    stageTimes,
    sendAmount: t.quote.sendAmount,
    sendCurrency: t.quote.sendCurrency,
    receiveAmount: t.quote.receiveAmount,
    receiveCurrency: t.quote.receiveCurrency,
    rate: t.quote.rate,
    recipientName: `${r.firstName} ${r.lastName}`,
    deliveryLabel:
      r.payoutMethod === 'cash'
        ? 'Cash pickup · MoneyGram'
        : `${r.bankName ?? 'Bank'} · •••• ${(r.accountNumber ?? '').replace(/\s/g, '').slice(-4)}`,
    txHash: stage === 'settling' || delivered ? bytesToHexStr(hash(new TextEncoder().encode(id))) : undefined,
    updatedAt: new Date().toISOString(),
  }
}

export function bytesToHexStr(b: Uint8Array) {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export const SAMPLE_RECIPIENTS: Recipient[] = [
  { id: 'r1', firstName: 'María', lastName: 'López', country: 'MX', payoutMethod: 'bank', bankName: 'BBVA México', accountNumber: '012180001234567890', mobile: '+52 55 1234 5678' },
  { id: 'r2', firstName: 'José', lastName: 'López', country: 'MX', payoutMethod: 'cash', mobile: '+52 55 8765 4321' },
  { id: 'r3', firstName: 'Ana', lastName: 'Costa', country: 'BR', payoutMethod: 'bank', bankName: 'Nubank', accountNumber: '26004512345678' },
]

export const SAMPLE_ACTIVITY: TransferSummary[] = [
  { id: 'demo-2', recipientName: 'José López', initials: 'JL', amount: '250.00', currency: 'USD', date: 'Oct 12', method: 'Cash pickup', state: 'completed' },
  { id: 'demo-3', recipientName: 'Ana Costa', initials: 'AC', amount: '120.00', currency: 'USD', date: 'Oct 05', method: 'Bank transfer', state: 'completed' },
]

/** Deterministic pseudo contract address derived from a passkey's public key. */
export function contractIdForPublicKey(publicKeyHex: string): string {
  return StrKey.encodeContract(hash(new TextEncoder().encode(publicKeyHex)))
}

/** Deterministic pseudo contract address derived from a credential id. */
export function contractIdForCredentialId(credentialId: string): string {
  return StrKey.encodeContract(hash(base64UrlToBytes(credentialId)))
}

export const mockApi: Api = {
  async registerOptions(displayName) {
    const userId = crypto.getRandomValues(new Uint8Array(16))
    return {
      options: {
        challenge: randomChallenge(),
        rp: { id: config.webauthn.rpId, name: config.webauthn.rpName },
        user: { id: bytesToBase64Url(userId), name: displayName, displayName },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        attestation: 'none',
        timeout: 60_000,
      },
    }
  },
  async registerVerify({ response, publicKeyHex }) {
    // Deterministic pseudo contract address so the same passkey maps to the same "account".
    const contractId = contractIdForPublicKey(publicKeyHex)
    extractP256PublicKey(response.response) // validates the key is present
    const displayName = localStorage.getItem('rp-display-name') ?? 'there'
    localStorage.setItem(`rp-demo-account:${response.id}`, JSON.stringify({ contractId, displayName }))
    return { token: 'demo', contractId, credentialId: response.id, displayName }
  },
  async loginOptions() {
    return { options: { challenge: randomChallenge(), rpId: config.webauthn.rpId, userVerification: 'required', timeout: 60_000 } }
  },
  async loginVerify({ response }) {
    const known = localStorage.getItem(`rp-demo-account:${response.id}`)
    const account = known
      ? (JSON.parse(known) as { contractId: string; displayName: string })
      : { contractId: contractIdForCredentialId(response.id), displayName: 'there' }
    return { token: 'demo', credentialId: response.id, ...account }
  },

  async getQuote({ sendAmount, sendCurrency, receiveCurrency }) {
    await delay(250)
    return buildQuote(sendAmount, sendCurrency, receiveCurrency)
  },
  async listRecipients() {
    return SAMPLE_RECIPIENTS
  },
  async listTransfers() {
    const live = Object.entries(store.read()).map(([id, t]): TransferSummary => {
      const s = statusFor(id, t)
      const r = t.req.recipient
      return {
        id,
        recipientName: s.recipientName,
        initials: `${r.firstName[0] ?? ''}${r.lastName[0] ?? ''}`.toUpperCase(),
        amount: t.quote.sendAmount,
        currency: t.quote.sendCurrency,
        date: 'Today',
        method: r.payoutMethod === 'cash' ? 'Cash pickup' : 'Bank transfer',
        state: s.state,
      }
    })
    return [...live.reverse(), ...SAMPLE_ACTIVITY]
  },
  async getBalance() {
    return { asset: 'USDC', amount: '1250.00' }
  },

  async createTransfer(req) {
    await delay(600)
    const quote = quotes.get(req.quoteId) ?? buildQuote('0', 'USD', 'MXN')
    const id = `tr_${crypto.randomUUID().slice(0, 8)}`
    const d = new Date()
    const reference = `RP-${d.toISOString().slice(2, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    const all = store.read()
    all[id] = { req, quote, createdAt: Date.now(), fundedAt: req.funding === 'wallet' ? Date.now() : null, reference }
    store.write(all)
    return {
      transferId: id,
      sep24: req.funding === 'partner' ? { id: `sep24_${id}`, url: null, anchorName: 'MoneyGram' } : undefined,
    }
  },
  async getTransfer(id) {
    const t = store.read()[id]
    if (!t) throw new Error('Transfer not found')
    return statusFor(id, t)
  },
  transferEventsUrl: () => null,

  async startSep24({ kind }) {
    await delay(300)
    return { id: `sep24_${kind}_${crypto.randomUUID().slice(0, 8)}`, url: null, anchorName: 'MoneyGram' }
  },
  async getSep24Status(id) {
    const t = store.read()[id.replace(/^sep24_/, '')]
    return { id, status: t?.fundedAt ? 'completed' : 'pending_user_transfer_start' }
  },
  async completeDemoFunding(transferId) {
    const all = store.read()
    if (all[transferId]) {
      all[transferId]!.fundedAt = Date.now()
      store.write(all)
    }
  },

  async issueSessionKey() {
    return { xdr: '' }
  },
  async confirmSessionKey() {
    await delay(400)
    return { hash: 'demo' }
  },
}
