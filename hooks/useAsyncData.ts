'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const cache = new Map<string, unknown>()
let cacheGeneration = 0

/** Cached data with cancellation on key change, unmount and logout. */
export function useAsyncData<T>(key: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<{
    key: string | null
    data: T | null
    error: string | null
    loading: boolean
  } | null>(null)
  const [revision, setRevision] = useState(0)
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  useEffect(() => {
    if (key === null) return
    let cancelled = false
    const generation = cacheGeneration
    const run = async () => {
      try {
        const data = await fetcherRef.current()
        if (cancelled || generation !== cacheGeneration) return
        cache.set(key, data)
        setState({ key, data, error: null, loading: false })
      } catch (err) {
        if (cancelled || generation !== cacheGeneration) return
        setState({
          key,
          data: (cache.get(key) as T | undefined) ?? null,
          error: err instanceof Error ? err.message : 'Something went wrong.',
          loading: false,
        })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [key, revision])

  const reload = useCallback(() => {
    setState((prev) => ({
      key,
      data: prev?.key === key ? prev.data : null,
      error: null,
      loading: key !== null,
    }))
    setRevision((prev) => prev + 1)
  }, [key])
  const cached = key !== null ? (cache.get(key) as T | undefined) : undefined
  const current = state?.key === key ? state : null
  return {
    data: key === null ? null : (current?.data ?? cached ?? null),
    error: current?.error ?? null,
    loading: key !== null && (current?.loading ?? cached === undefined),
    reload,
  }
}

export function invalidateAsyncData(key: string) {
  cache.delete(key)
}

/** Prevent old requests from repopulating another user's cache after logout. */
export function clearAsyncDataCache() {
  cacheGeneration++
  cache.clear()
}
