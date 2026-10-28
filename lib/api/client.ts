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

const DEFAULT_TIMEOUT_MS = 20_000

export interface RequestOptions extends RequestInit {
  /** Per-call timeout override in milliseconds. Defaults to `config.apiTimeoutMs` (or 20s). */
  timeoutMs?: number
}

/** True when `err` is an `ApiError` produced by a request timeout/abort. */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'timeout'
}

async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const { timeoutMs, signal: callerSignal, ...rest } = init
  const timeout =
    timeoutMs ?? (config as { apiTimeoutMs?: number }).apiTimeoutMs ?? DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeout)

  // Combine caller-provided signal with our timeout signal where supported.
  let signal: AbortSignal = controller.signal
  if (callerSignal) {
    const anyFn = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any
    if (typeof anyFn === 'function') {
      signal = anyFn([callerSignal, controller.signal])
    } else {
      callerSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  try {
    const res = await fetch(`${config.backendUrl}${path}`, {
      ...rest,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...rest.headers,
      },
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string }
      throw new ApiError(body.message ?? `Request failed (${res.status})`, res.status, body.code)
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
  } catch (err) {
    if (timedOut || (err instanceof DOMException && err.name === 'AbortError')) {
      throw new ApiError('Request timed out. Please try again.', 0, 'timeout')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

const post = <T>(path: string, body?: unknown, options?: { timeoutMs?: number }) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}), ...options })

/**
 * RemitPulse relay/backend contract. Endpoint shapes are documented in the README
 * ("Backend API contract"). With NEXT_PUBLIC_DEMO_MODE=true the mock is used.
 */
export const realApi = {
  registerOptions: (displayName: string) =>
    post<RegisterOptionsResponse>('/auth/register/options', { displayName }),
  registerVerify: (body: RegisterVerifyRequest) => post<Session>('/auth/register/verify', body),
  loginOptions: () => post<LoginOptionsResponse>('/auth/login/options'),
  loginVerify: (body: LoginVerifyRequest) => post<Session>('/auth/login/verify', body),

  getQuote: (p: {
    sendAmount: string
    sendCurrency: SendCurrency
    receiveCurrency: ReceiveCurrency
  }) => request<Quote>(`/quotes?${new URLSearchParams(p as Record<string, string>)}`),

  listRecipients: () => request<Recipient[]>('/recipients'),
  listTransfers: () => request<TransferSummary[]>('/transfers'),
  getBalance: (contractId: string) =>
    request<{ asset: string; amount: string }>(`/accounts/${contractId}/balance`),

  /** Records the transfer; the relay wraps `signedXdr` in a sponsored fee bump and submits it (immediately, or once SEP-24 funding completes). */
  createTransfer: (body: CreateTransferRequest) => post<CreateTransferResponse>('/transfers', body),
  getTransfer: (id: string) => request<TransferStatus>(`/transfers/${encodeURIComponent(id)}`),
  /** Server-sent events stream of TransferStatus; null when unsupported. */
  transferEventsUrl: (id: string): string | null =>
    `${config.backendUrl}/transfers/${encodeURIComponent(id)}/events`,

  /** Standalone SEP-24 interactive deposit/withdraw for the wallet (backend performs SEP-10/45 auth with the anchor). */
  startSep24: (body: { kind: 'deposit' | 'withdraw'; asset: AssetCode; amount?: string }) =>
    post<{ id: string; url: string | null; anchorName: string }>('/sep24/interactive', body),
  getSep24Status: (id: string, options?: { timeoutMs?: number }) =>
    request<Sep24Status>(`/sep24/transactions/${encodeURIComponent(id)}`, options),
  completeDemoFunding: (_transferId: string, _options?: { timeoutMs?: number }) =>
    Promise.resolve(),

  issueSessionKey: (body: SessionKeyIssueRequest) =>
    post<SessionKeyIssueResponse>('/session-keys', body),
  /** Relay submits the passkey-signed `add_signer` invocation via a sponsored fee bump. */
  confirmSessionKey: (body: { contractId: string; signedXdr: string }) =>
    post<{ hash: string }>('/session-keys/confirm', body),
}

export type Api = typeof realApi

export const api: Api = config.demoMode ? mockApi : realApi
