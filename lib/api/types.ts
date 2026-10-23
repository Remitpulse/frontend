import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser'
import type { AssetCode } from '@/lib/config'
import type { ReceiveCurrency, SendCurrency } from '@/lib/stellar/assets'

export interface Session {
  token: string
  /** The user's deployed smart-account contract (C...). */
  contractId: string
  credentialId: string
  displayName: string
}

export interface RegisterOptionsResponse {
  options: PublicKeyCredentialCreationOptionsJSON
}

export interface RegisterVerifyRequest {
  response: RegistrationResponseJSON
  /** Uncompressed SEC1 P-256 key (hex) the account contract will store. */
  publicKeyHex: string
}

export interface LoginOptionsResponse {
  options: PublicKeyCredentialRequestOptionsJSON
}

export interface LoginVerifyRequest {
  response: AuthenticationResponseJSON
}

export interface Quote {
  id: string
  sendAmount: string
  sendCurrency: SendCurrency
  sendAsset: AssetCode
  receiveAmount: string
  receiveCurrency: ReceiveCurrency
  settlementAsset: AssetCode
  rate: string
  fees: { platform: string; partner: string; network: string }
  amountConverted: string
  totalCost: string
  expiresAt: string
  deliveryEstimate: string
  /** Settlement address the smart account pays (anchor or payout pool). */
  payTo: string
}

export interface Recipient {
  id?: string
  firstName: string
  lastName: string
  country: string
  payoutMethod: 'bank' | 'cash'
  bankName?: string
  accountNumber?: string
  mobile?: string
}

export type FundingSource = 'wallet' | 'partner'

export interface CreateTransferRequest {
  quoteId: string
  recipient: Recipient
  saveRecipient: boolean
  funding: FundingSource
  /** Passkey/session-key authorised transfer, assembled for the relay. */
  signedXdr: string
  signer: 'passkey' | 'session'
}

export interface CreateTransferResponse {
  transferId: string
  /** Present when funding = partner: interactive SEP-24 deposit. */
  sep24?: { id: string; url: string | null; anchorName: string }
}

export type TransferStage = 'funding' | 'received' | 'converted' | 'settling' | 'delivered'
export type TransferState = 'awaiting_funding' | 'in_progress' | 'completed' | 'failed' | 'needs_attention'

export interface TransferStatus {
  id: string
  reference: string
  state: TransferState
  stage: TransferStage
  stageTimes: Partial<Record<TransferStage, string>>
  sendAmount: string
  sendCurrency: SendCurrency
  receiveAmount: string
  receiveCurrency: ReceiveCurrency
  rate: string
  recipientName: string
  deliveryLabel: string
  txHash?: string
  updatedAt: string
  message?: string
}

export interface TransferSummary {
  id: string
  recipientName: string
  initials: string
  amount: string
  currency: SendCurrency
  date: string
  method: string
  state: TransferState
}

export interface SessionKeyIssueRequest {
  contractId: string
  /** Raw Ed25519 public key, hex. */
  publicKeyHex: string
  maxAmount: number
  ttlMinutes: number
}

export interface SessionKeyIssueResponse {
  /** Unsigned `add_signer` invocation for the passkey to authorise. */
  xdr: string
}

export interface Sep24Status {
  id: string
  status: string
  moreInfoUrl?: string
}
