'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTransferDraft } from '@/components/providers/TransferDraftProvider'
import { Avatar } from '@/components/ui/Avatar'
import { ButtonLink, Spinner } from '@/components/ui/Button'
import { ChevronRightIcon, PlusIcon } from '@/components/ui/Icons'
import { api } from '@/lib/api/client'
import type { Recipient } from '@/lib/api/types'
import { initials, maskAccount } from '@/lib/format'
import { CORRIDORS } from '@/lib/stellar/assets'

/** M12 · Recipients. */
export default function RecipientsPage() {
  const { update } = useTransferDraft()
  const [items, setItems] = useState<Recipient[] | null>(null)
  useEffect(() => {
    api.listRecipients().then(setItems, () => setItems([]))
  }, [])

  return (
    <main className="mx-auto max-w-flow px-6 pb-8 pt-8 lg:pt-10">
      <h1 className="text-[26px] font-bold text-navy">Recipients</h1>
      {!items ? (
        <Spinner className="mt-10 h-6 w-6 text-royal" />
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {items.map((r) => {
            const corridor = CORRIDORS.find((c) => c.country === r.country)
            return (
              <li key={r.id}>
                <Link
                  href="/send"
                  onClick={() => update({ recipient: r, payoutMethod: r.payoutMethod, receiveCurrency: corridor?.currency ?? 'MXN' })}
                  className="flex items-center gap-4 py-4"
                >
                  <Avatar initials={initials(r.firstName, r.lastName)} />
                  <div className="flex-1">
                    <p className="font-semibold text-ink">
                      {r.firstName} {r.lastName}
                    </p>
                    <p className="text-caption text-muted">
                      {r.payoutMethod === 'cash' ? 'Cash pickup' : `${r.bankName} · ${maskAccount(r.accountNumber)}`} · {corridor?.countryName}
                    </p>
                  </div>
                  <ChevronRightIcon className="text-muted" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <ButtonLink href="/send" variant="secondary" icon={<PlusIcon />} className="mt-6">
        Add recipient
      </ButtonLink>
    </main>
  )
}
