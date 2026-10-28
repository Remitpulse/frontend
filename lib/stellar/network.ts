import { rpc } from '@stellar/stellar-sdk'
import { config } from '@/lib/config'

let server: rpc.Server | null = null

export function getRpc(): rpc.Server {
  if (!server) {
    server = new rpc.Server(config.rpcUrl, { allowHttp: config.rpcUrl.startsWith('http://') })
  }
  return server
}

export function explorerTxUrl(hash: string) {
  return `${config.explorerUrl}/tx/${hash}`
}

export function explorerContractUrl(contractId: string) {
  return `${config.explorerUrl}/contract/${contractId}`
}
