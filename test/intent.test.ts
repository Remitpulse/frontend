import {
  Address,
  StrKey,
  xdr,
  nativeToScVal,
  TransactionBuilder,
  Operation,
} from '@stellar/stellar-sdk'
import { describe, expect, it } from 'vitest'
import { assertAuthorizationIntent, contractInvocation } from '@/lib/stellar/intent'
import { buildInvocation, signPreparedXdr } from '@/lib/stellar/smartAccount'

const account = StrKey.encodeContract(new Uint8Array(32).fill(1))
const token = StrKey.encodeContract(new Uint8Array(32).fill(2))
const payTo = StrKey.encodeContract(new Uint8Array(32).fill(3))
const args = [
  new Address(account).toScVal(),
  new Address(payTo).toScVal(),
  nativeToScVal(100n, { type: 'i128' }),
]
const invocation = contractInvocation(buildInvocation(token, 'transfer', args))
function entry(address = account, call = invocation, nested = false) {
  const root = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(call),
    subInvocations: [],
  })
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(address).toScAddress(),
        nonce: 1n,
        signatureExpirationLedger: 0,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: nested
      ? new xdr.SorobanAuthorizedInvocation({ function: root.function, subInvocations: [root] })
      : root,
  })
}

describe('authorization intent (real SDK XDR; no network)', () => {
  it('accepts exactly the local transfer and account', () => {
    expect(() => assertAuthorizationIntent([entry()], invocation, account)).not.toThrow()
  })
  it('rejects foreign credentials, extra entries and missing authorization', () => {
    expect(() => assertAuthorizationIntent([entry(payTo)], invocation, account)).toThrow('account')
    expect(() => assertAuthorizationIntent([], invocation, account)).toThrow('exactly one')
    expect(() => assertAuthorizationIntent([entry(), entry()], invocation, account)).toThrow(
      'exactly one',
    )
  })
  it.each([
    ['recipient', token, 'transfer', [args[0], args[0], args[2]]],
    ['amount', token, 'transfer', [args[0], args[1], nativeToScVal(200n, { type: 'i128' })]],
    ['method', token, 'approve', args],
    ['contract', account, 'transfer', args],
  ] as const)('rejects substituted %s', (_name, contract, method, values) => {
    const changed = contractInvocation(buildInvocation(contract, method, [...values]))
    expect(() => assertAuthorizationIntent([entry(account, changed)], invocation, account)).toThrow(
      'approved invocation',
    )
  })
  it('rejects hidden nested invocations', () => {
    expect(() =>
      assertAuthorizationIntent([entry(account, invocation, true)], invocation, account),
    ).toThrow('approved invocation')
  })
  it('rejects multiple operations before a signer or RPC can run', async () => {
    const tx = buildInvocation(token, 'transfer', args)
    const multiple = TransactionBuilder.cloneFrom(tx)
      .addOperation(
        Operation.invokeContractFunction({ contract: token, function: 'transfer', args }),
      )
      .build()
    expect(() => contractInvocation(multiple)).toThrow('exactly one')
    await expect(
      signPreparedXdr({
        xdr: multiple.toXDR(),
        accountId: account,
        signer: async () => {
          throw new Error('must not sign')
        },
        ttlLedgers: 60,
      }),
    ).rejects.toThrow('exactly one')
  })
})
