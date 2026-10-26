import {
  Account,
  Address,
  Keypair,
  Operation,
  TransactionBuilder,
  authorizeEntry,
  nativeToScVal,
  rpc,
  scValToBigInt,
  xdr,
  type Transaction,
} from '@stellar/stellar-sdk'
import { config } from '@/lib/config'
import { getRpc } from './network'

export { buildInvocation as __buildInvocationForTest }

/**
 * Produces the `__check_auth` signature for a Soroban authorization payload.
 * `payload` is sha256(HashIdPreimage::SorobanAuthorization) — 32 bytes.
 */
export type AuthSigner = (payload: Uint8Array) => Promise<xdr.ScVal>

/** Ledgers (~5s each) a signed authorization stays valid. */
export const AUTH_TTL_LEDGERS = {
  /** Submitted immediately from wallet balance. */
  immediate: 60,
  /** Held by the relay until partner (SEP-24) funding completes. */
  deferred: 720,
} as const

// Simulation only needs a syntactically valid source; the relay rebuilds the
// envelope with its own sponsored source account before fee-bumping.
const SIMULATION_SOURCE = Keypair.random().publicKey()

export function buildInvocation(contractId: string, method: string, args: xdr.ScVal[]): Transaction {
  return new TransactionBuilder(new Account(SIMULATION_SOURCE, '0'), {
    fee: '100',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({ contract: contractId, function: method, args }),
    )
    .setTimeout(300)
    .build()
}

export async function simulate(tx: Transaction) {
  const sim = await getRpc().simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) throw new Error(`Simulation failed: ${sim.error}`)
  if (rpc.Api.isSimulationRestore(sim)) {
    throw new Error('Contract state needs restoring; ask the relay to restore the footprint and retry.')
  }
  return sim
}

/**
 * Signs and assembles an invocation that the smart account must authorise.
 *
 * 1. Simulate (recording mode) to discover auth entries for the account.
 * 2. Sign each entry whose credential address is the account via `signer`.
 * 3. Re-simulate (enforcing mode) so `__check_auth` and its storage reads are
 *    included in the footprint and resource fee.
 * 4. Assemble — existing signed auth is preserved by `assembleTransaction`.
 *
 * Returns base64 XDR for the relay to wrap in a sponsored fee bump.
 */
export async function signAndAssemble(params: {
  tx: Transaction
  accountId: string
  signer: AuthSigner
  ttlLedgers: number
}): Promise<string> {
  const { tx } = params
  const [recording, latest] = await Promise.all([simulate(tx), getRpc().getLatestLedger()])
  const validUntil = latest.sequence + params.ttlLedgers

  const entries = recording.result?.auth ?? []
  const signed = []
  // Sequential: each entry may open its own passkey prompt.
  for (const entry of entries) {
    if (entry.credentials.type === 'sorobanCredentialsSourceAccount') {
      signed.push(entry)
      continue
    }
    signed.push(
      await authorizeEntry(
        entry,
        async (_preimage, payload) => ({ signatureScVal: await params.signer(payload) }),
        validUntil,
        config.networkPassphrase,
        params.accountId,
      ),
    )
  }

  const op = tx.operations[0] as Operation.InvokeHostFunction
  const withAuth = TransactionBuilder.cloneFrom(tx)
    .clearOperations()
    .addOperation(Operation.invokeHostFunction({ func: op.func, auth: signed }))
    .build()

  const enforcing = await simulate(withAuth)
  return rpc.assembleTransaction(withAuth, enforcing).build().toXDR()
}

/** Signs an unsigned invocation prepared by the backend (e.g. session-key `add_signer`). */
export function signPreparedXdr(params: { xdr: string; accountId: string; signer: AuthSigner; ttlLedgers: number }) {
  const tx = TransactionBuilder.fromXDR(params.xdr, config.networkPassphrase) as Transaction
  return signAndAssemble({ tx, accountId: params.accountId, signer: params.signer, ttlLedgers: params.ttlLedgers })
}

/** SAC `transfer(from, to, amount)` signed by the smart account. */
export function buildTokenTransfer(params: {
  accountId: string
  tokenContractId: string
  to: string
  amount: bigint
  signer: AuthSigner
  ttlLedgers: number
}) {
  const tx = buildInvocation(params.tokenContractId, 'transfer', [
    new Address(params.accountId).toScVal(),
    new Address(params.to).toScVal(),
    nativeToScVal(params.amount, { type: 'i128' }),
  ])
  return signAndAssemble({ tx, accountId: params.accountId, signer: params.signer, ttlLedgers: params.ttlLedgers })
}

/** SAC `balance(id)` via read-only simulation. */
export async function readTokenBalance(tokenContractId: string, accountId: string): Promise<bigint> {
  const tx = buildInvocation(tokenContractId, 'balance', [new Address(accountId).toScVal()])
  const sim = await simulate(tx)
  return sim.result?.retval ? scValToBigInt(sim.result.retval) : 0n
}
