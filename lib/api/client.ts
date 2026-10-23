import { config, type AssetCode } from '@/lib/config'
import { mockApi } from './mock'
import type {
  CreateTransferRequest,
  CreateTransferResponse,
  LoginOptionsResponse,
  LoginVerifyRequest,
  Quote,
  Recipient,
  RegisterOptionsResponse,
  RegisterVerifyRequest,
  Sep24Status,
  Session,
  SessionKeyIssueRequest,
  SessionKeyIssueResponse,
  TransferStatus,
  TransferSummary,
} from './types'
import type { ReceiveCurrency, SendCurrency } from '@/lib/stellar/assets'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

let authToken: string | null = null
export function setAuthToken(token: string | null) {
  authToken = token
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${config.backendUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string }
    throw new ApiError(body.message ?? `Request failed (${res.status})`, res.status, body.code)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })

/**
 * RemitPulse relay/backend contract. Endpoint shapes are documented in the README
 * ("Backend API contract"). With NEXT_PUBLIC_DEMO_MODE=true the mock is used.
 */
export const realApi = {
  registerOptions: (displayName: string) => post<RegisterOptionsResponse>('/auth/register/options', { displayName }),
  registerVerify: (body: RegisterVerifyRequest) => post<Session>('/auth/register/verify', body),
  loginOptions: () => post<LoginOptionsResponse>('/auth/login/options'),
  loginVerify: (body: LoginVerifyRequest) => post<Session>('/auth/login/verify', body),

  getQuote: (p: { sendAmount: string; sendCurrency: SendCurrency; receiveCurrency: ReceiveCurrency }) =>
    request<Quote>(`/quotes?${new URLSearchParams(p as Record<string, string>)}`),

  listRecipients: () => request<Recipient[]>('/recipients'),
  listTransfers: () => request<TransferSummary[]>('/transfers'),
  getBalance: (contractId: string) => request<{ asset: string; amount: string }>(`/accounts/${contractId}/balance`),

  /** Records the transfer; the relay wraps `signedXdr` in a sponsored fee bump and submits it (immediately, or once SEP-24 funding completes). */
  createTransfer: (body: CreateTransferRequest) => post<CreateTransferResponse>('/transfers', body),
  getTransfer: (id: string) => request<TransferStatus>(`/transfers/${encodeURIComponent(id)}`),
  /** Server-sent events stream of TransferStatus; null when unsupported. */
  transferEventsUrl: (id: string): string | null => `${config.backendUrl}/transfers/${encodeURIComponent(id)}/events`,

  /** Standalone SEP-24 interactive deposit/withdraw for the wallet (backend performs SEP-10/45 auth with the anchor). */
  startSep24: (body: { kind: 'deposit' | 'withdraw'; asset: AssetCode; amount?: string }) =>
    post<{ id: string; url: string | null; anchorName: string }>('/sep24/interactive', body),
  getSep24Status: (id: string) => request<Sep24Status>(`/sep24/transactions/${encodeURIComponent(id)}`),
  completeDemoFunding: (_transferId: string) => Promise.resolve(),

  issueSessionKey: (body: SessionKeyIssueRequest) => post<SessionKeyIssueResponse>('/session-keys', body),
  /** Relay submits the passkey-signed `add_signer` invocation via a sponsored fee bump. */
  confirmSessionKey: (body: { contractId: string; signedXdr: string }) =>
    post<{ hash: string }>('/session-keys/confirm', body),
}

export type Api = typeof realApi

export const api: Api = config.demoMode ? mockApi : realApi
