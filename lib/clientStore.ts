/** A small client store with a stable, empty server snapshot for hydration. */
export function createClientStore<T>(initial: T, restore: () => T) {
  const serverSnapshot = { value: initial, ready: false }
  let snapshot = serverSnapshot
  const listeners = new Set<() => void>()
  const publish = (value: T) => {
    snapshot = { value, ready: true }
    listeners.forEach((listener) => listener())
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    set: publish,
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (!snapshot.ready) publish(restore())
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
