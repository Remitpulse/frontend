'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const cache = new Map<string, unknown>()

/**
 * Stale-while-revalidate data fetching: returns a cached value instantly on
 * remount (no spinner flash when navigating back to a page) while refetching
 * in the background, and surfaces fetch failures instead of swallowing them.
 */
export function useAsyncData<T>(key: string | null, fetcher: () => Promise<T>) {
  const cached = key !== null ? (cache.get(key) as T | undefined) : undefined
  const [data, setData] = useState<T | null>(cached ?? null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(key !== null && cached === undefined)
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const load = useCallback(
    async (silent: boolean) => {
      if (key === null) return
      if (!silent) setLoading(true)
      setError(null)
      try {
        const result = await fetcherRef.current()
        cache.set(key, result)
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    },
    [key],
  )

  useEffect(() => {
    load(cache.has(key ?? '') && key !== null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { data, loading, error, reload: () => load(false) }
}

/** Drops a cached entry so the next `useAsyncData` call for it refetches from scratch. */
export function invalidateAsyncData(key: string) {
  cache.delete(key)
}

/**
 * Drops every cached entry. Must be called on sign-out so a different account
 * signing in on the same tab can never see the previous account's data.
 */
export function clearAsyncDataCache() {
  cache.clear()
}
