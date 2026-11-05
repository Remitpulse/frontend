import { Address, type Transaction, type xdr } from '@stellar/stellar-sdk'

/** Only the single contract invocation shown by the transfer UI is supported. */
export function contractInvocation(tx: Transaction): xdr.InvokeContractArgs {
  if (!Array.isArray(tx.operations) || tx.operations.length !== 1) {
    throw new Error('Expected exactly one contract invocation')
  }
  const op = tx.operations[0]
  if (op.type !== 'invokeHostFunction' || op.func.type !== 'hostFunctionTypeInvokeContract') {
    throw new Error('Unsupported transaction operation')
  }
  return op.func.invokeContract
}

/** Reject extra authorization scope returned by an untrusted RPC before prompting. */
export function assertAuthorizationIntent(
  entries: xdr.SorobanAuthorizationEntry[],
  expected: xdr.InvokeContractArgs,
  accountId: string,
): void {
  if (entries.length !== 1) throw new Error('Expected exactly one account authorization')
  for (const entry of entries) {
    const credentials = entry.credentials
    if (
      credentials.type !== 'sorobanCredentialsAddress' &&
      credentials.type !== 'sorobanCredentialsAddressV2'
    ) {
      throw new Error('Unsupported authorization credentials')
    }
    if (Address.fromScAddress(credentials.value.address).toString() !== accountId) {
      throw new Error('Unexpected authorization account')
    }
    const root = entry.rootInvocation
    if (
      root.function.type !== 'sorobanAuthorizedFunctionTypeContractFn' ||
      root.function.contractFn.toXdr('base64') !== expected.toXdr('base64') ||
      root.subInvocations.length !== 0
    ) {
      throw new Error('Authorization does not match the approved invocation')
    }
  }
}
