/**
 * Ed25519 session keys for low-value transfers.
 *
 * The private key is generated with WebCrypto as **non-extractable** and kept
 * in IndexedDB, so scripts can ask it to sign but can never read the key
 * material. The account contract enforces the key's scope (spend limit,
 * expiry) on-chain; the client-side checks here only decide when to *try* it.
 */

const DB_NAME = 'remitpulse'
const STORE = 'session-keys'
const RECORD_ID = 'active'

export interface SessionKeyRecord {
  id: typeof RECORD_ID
  contractId: string
  privateKey: CryptoKey
  publicKey: Uint8Array
  /** Max amount per transfer in send-asset units, as registered on-chain. */
  maxAmount: number
  expiresAt: number
  /** Set once the backend confirms `add_signer` landed on-chain. */
  registered: boolean
}

export function supportsEd25519SessionKeys(): boolean {
  return typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined' && !!crypto.subtle
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function generateSessionKey(params: {
  contractId: string
  maxAmount: number
  ttlMinutes: number
}): Promise<SessionKeyRecord> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify'])) as CryptoKeyPair
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  return {
    id: RECORD_ID,
    contractId: params.contractId,
    privateKey: pair.privateKey,
    publicKey,
    maxAmount: params.maxAmount,
    expiresAt: Date.now() + params.ttlMinutes * 60_000,
    registered: false,
  }
}

export async function saveSessionKey(record: SessionKeyRecord): Promise<void> {
  await tx('readwrite', (s) => s.put(record))
}

export async function loadSessionKey(contractId: string): Promise<SessionKeyRecord | null> {
  if (!supportsEd25519SessionKeys()) return null
  const record = (await tx('readonly', (s) => s.get(RECORD_ID))) as SessionKeyRecord | undefined
  if (!record || record.contractId !== contractId) return null
  if (record.expiresAt <= Date.now()) {
    await clearSessionKey()
    return null
  }
  return record
}

export async function clearSessionKey(): Promise<void> {
  if (!supportsEd25519SessionKeys()) return
  await tx('readwrite', (s) => s.delete(RECORD_ID))
}

export async function signWithSessionKey(record: SessionKeyRecord, payload: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, record.privateKey, payload as BufferSource))
}

export function sessionKeyCovers(record: SessionKeyRecord | null, amount: number): record is SessionKeyRecord {
  return !!record && record.registered && record.expiresAt > Date.now() && amount <= record.maxAmount
}
