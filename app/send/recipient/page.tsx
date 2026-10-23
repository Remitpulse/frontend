'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { FlowHeader, FlowPage } from '@/components/layout/FlowHeader'
import { useTransferDraft } from '@/components/providers/TransferDraftProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { ArrowRightIcon } from '@/components/ui/Icons'
import { api } from '@/lib/api/client'
import type { Recipient } from '@/lib/api/types'
import { initials } from '@/lib/format'
import { ACCOUNT_RULES, formatClabe } from '@/lib/recipients'
import { CORRIDORS } from '@/lib/stellar/assets'

type Errors = Partial<Record<'firstName' | 'lastName' | 'accountNumber' | 'mobile', string>>

/** 03 · Recipient details — bank transfer / 10 · Cash pickup recipient. */
export default function RecipientPage() {
  const router = useRouter()
  const { draft, update } = useTransferDraft()
  const corridor = CORRIDORS.find((c) => c.currency === draft.receiveCurrency)!
  const rule = ACCOUNT_RULES[draft.receiveCurrency]
  const isCash = draft.payoutMethod === 'cash'

  const [saved, setSaved] = useState<Recipient[]>([])
  const [form, setForm] = useState<Recipient>(
    draft.recipient ?? {
      firstName: '',
      lastName: '',
      country: corridor.country,
      payoutMethod: draft.payoutMethod,
      bankName: rule.banks[0],
      accountNumber: '',
      mobile: '',
    },
  )
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!draft.quote) router.replace('/send')
  }, [draft.quote, router])

  useEffect(() => {
    api.listRecipients().then(
      (all) => setSaved(all.filter((r) => r.country === corridor.country && r.payoutMethod === draft.payoutMethod)),
      () => setSaved([]),
    )
  }, [corridor.country, draft.payoutMethod])

  const set = (patch: Partial<Recipient>) => setForm((f) => ({ ...f, ...patch }))

  const validate = (): Errors => {
    const e: Errors = {}
    if (!form.firstName.trim()) e.firstName = 'Enter their first name.'
    if (!form.lastName.trim()) e.lastName = 'Enter their last name.'
    if (!isCash) {
      const err = rule.validate(form.accountNumber ?? '')
      if (err) e.accountNumber = err
    }
    if (isCash && !(form.mobile ?? '').replace(/\D/g, '').length) e.mobile = 'A mobile number is required for cash pickup.'
    return e
  }

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    update({
      recipient: {
        ...form,
        country: corridor.country,
        payoutMethod: draft.payoutMethod,
        accountNumber: isCash ? undefined : form.accountNumber?.replace(/\s/g, ''),
        bankName: isCash ? undefined : form.bankName,
      },
    })
    router.push('/send/review')
  }

  return (
    <FlowPage>
      <FlowHeader title="Recipient details" backHref="/send" step={{ current: 2, total: 3, label: 'Recipient' }} />

      <h2 className="mt-6 text-[26px] font-bold leading-tight text-navy">Who are you sending to?</h2>
      <p className="mt-2 text-body text-muted">
        {isCash ? 'Use their name exactly as it appears on their photo ID.' : 'Use their name as it appears on their bank account.'}
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        {saved.length > 0 && (
          <div className="flex items-center gap-4 rounded-card border border-border bg-white p-4">
            <Avatar initials={form.firstName ? initials(form.firstName, form.lastName) : '+'} />
            <div className="min-w-0 flex-1">
              <label htmlFor="saved" className="block font-semibold text-ink">
                {form.firstName ? `${form.firstName} ${form.lastName}` : 'New recipient'}
              </label>
              <select
                id="saved"
                className="mt-0.5 w-full cursor-pointer appearance-none bg-transparent text-[13px] text-royal outline-none"
                value={form.id ?? ''}
                onChange={(e) => {
                  const r = saved.find((s) => s.id === e.target.value)
                  setErrors({})
                  setForm(
                    r ?? { firstName: '', lastName: '', country: corridor.country, payoutMethod: draft.payoutMethod, bankName: rule.banks[0], accountNumber: '', mobile: '' },
                  )
                }}
              >
                <option value="">Use saved recipient ▾</option>
                {saved.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.firstName} {r.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <TextField label="First name" autoComplete="off" value={form.firstName} error={errors.firstName} onChange={(e) => set({ firstName: e.target.value })} />
          <TextField label="Last name" autoComplete="off" value={form.lastName} error={errors.lastName} onChange={(e) => set({ lastName: e.target.value })} />
        </div>

        {!isCash && (
          <>
            <SelectField label="Bank" value={form.bankName} onChange={(e) => set({ bankName: e.target.value })}>
              {rule.banks.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </SelectField>
            <TextField
              label={rule.label}
              inputMode={draft.receiveCurrency === 'MXN' || draft.receiveCurrency === 'ARS' ? 'numeric' : 'text'}
              placeholder={rule.placeholder}
              value={draft.receiveCurrency === 'MXN' ? formatClabe(form.accountNumber ?? '') : form.accountNumber}
              hint={rule.hint}
              error={errors.accountNumber}
              onChange={(e) => set({ accountNumber: e.target.value })}
            />
          </>
        )}

        <TextField
          label="Mobile number"
          type="tel"
          prefix={rule.dialCode}
          value={(form.mobile ?? '').replace(rule.dialCode, '').trim()}
          hint={isCash ? 'We’ll text the pickup reference to this number.' : 'We’ll send a text when the money arrives.'}
          error={errors.mobile}
          onChange={(e) => set({ mobile: `${rule.dialCode} ${e.target.value}` })}
        />

        <label className="flex items-center gap-3 text-body text-ink">
          <input
            type="checkbox"
            checked={draft.saveRecipient}
            onChange={(e) => update({ saveRecipient: e.target.checked })}
            className="h-4 w-4 accent-royal"
          />
          Save recipient for next time
        </label>

        <Button type="submit" icon={<ArrowRightIcon />}>
          Review transfer
        </Button>
      </form>
    </FlowPage>
  )
}
