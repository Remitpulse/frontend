// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAsyncDataCache, useAsyncData } from '@/hooks/useAsyncData'

beforeEach(clearAsyncDataCache)
afterEach(cleanup)
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('account-scoped async data', () => {
  it('hides the old account data immediately and ignores its late response', async () => {
    const old = deferred<string>()
    const { result, rerender } = renderHook(
      ({ key }) =>
        useAsyncData(key, () => (key === 'old' ? old.promise : Promise.resolve('new data'))),
      { initialProps: { key: 'old' } },
    )
    rerender({ key: 'new' })
    expect(result.current.data).toBeNull()
    await waitFor(() => expect(result.current.data).toBe('new data'))
    await act(async () => {
      old.resolve('private old data')
      await old.promise
    })
    expect(result.current.data).toBe('new data')
  })
  it('does not let requests repopulate cache after sign-out', async () => {
    const old = deferred<string>()
    const { unmount } = renderHook(() => useAsyncData('private', () => old.promise))
    clearAsyncDataCache()
    await act(async () => {
      old.resolve('private')
      await old.promise
    })
    unmount()
    const next = deferred<string>()
    const { result } = renderHook(() => useAsyncData('private', () => next.promise))
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
  })
  it('surfaces failure and reloads while retaining the last successful value', async () => {
    let fail = false
    const { result } = renderHook(() =>
      useAsyncData('balance', () =>
        fail ? Promise.reject(new Error('offline')) : Promise.resolve('10'),
      ),
    )
    await waitFor(() => expect(result.current.data).toBe('10'))
    fail = true
    act(() => {
      result.current.reload()
    })
    await waitFor(() => expect(result.current.error).toBe('offline'))
    expect(result.current.data).toBe('10')
    expect(result.current.loading).toBe(false)
  })
})
