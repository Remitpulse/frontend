'use client'

import { useEffect, useState } from 'react'
import { ActivityList } from '@/components/ActivityList'
import { Spinner } from '@/components/ui/Button'
import { api } from '@/lib/api/client'
import type { TransferSummary } from '@/lib/api/types'

/** M07 · Activity. */
export default function ActivityPage() {
  const [items, setItems] = useState<TransferSummary[] | null>(null)
  useEffect(() => {
    api.listTransfers().then(setItems, () => setItems([]))
  }, [])

  return (
    <main className="mx-auto max-w-3xl px-6 pb-8 pt-8 lg:px-10 lg:pt-10">
      <h1 className="text-[26px] font-bold text-navy">Activity</h1>
      {!items ? (
        <Spinner className="mt-10 h-6 w-6 text-royal" />
      ) : items.length === 0 ? (
        <p className="mt-6 text-body text-muted">No transfers yet.</p>
      ) : (
        <div className="mt-4">
          <ActivityList items={items} />
        </div>
      )}
    </main>
  )
}
