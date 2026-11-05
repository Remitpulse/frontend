import type { SessionKeyRecord } from './sessionKeys'

let record: SessionKeyRecord | null = null
let version = 0
let channel: BroadcastChannel | null = null
const listeners = new Set<() => void>()
export const sessionKeyStore = {
  getSnapshot: () => record,
  getServerSnapshot: () => null,
  getVersion: () => version,
  set(value: SessionKeyRecord | null) {
    version++
    record = value
    listeners.forEach((listener) => listener())
  },
  notifyOtherTabs() {
    channel?.postMessage('invalidate')
  },
  subscribe(listener: () => void) {
    if (!channel && typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('remitpulse-session-key')
      channel.onmessage = () => sessionKeyStore.set(null)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        channel?.close()
        channel = null
      }
    }
  },
}
