import type { ReceiveCurrency } from '@/lib/stellar/assets'

interface AccountRule {
  label: string
  hint: string
  placeholder: string
  validate: (v: string) => string | null
  banks: string[]
  dialCode: string
}

const digits = (v: string) => v.replace(/\s/g, '')

export const ACCOUNT_RULES: Record<ReceiveCurrency, AccountRule> = {
  MXN: {
    label: 'CLABE · 18 digits',
    hint: 'Find this number in your recipient’s banking app.',
    placeholder: '012 180 00123456789 0',
    validate: (v) => (/^\d{18}$/.test(digits(v)) ? null : 'Enter all 18 digits to continue.'),
    banks: ['BBVA México', 'Banorte', 'Santander México', 'Citibanamex', 'HSBC México', 'Banco Azteca'],
    dialCode: '+52',
  },
  BRL: {
    label: 'PIX key',
    hint: 'CPF, phone, email or random key.',
    placeholder: '123.456.789-09',
    validate: (v) => (v.trim().length >= 5 ? null : 'Enter a valid PIX key.'),
    banks: ['Nubank', 'Itaú', 'Banco do Brasil', 'Bradesco', 'Caixa'],
    dialCode: '+55',
  },
  ARS: {
    label: 'CBU / CVU · 22 digits',
    hint: 'Shown in your recipient’s bank or wallet app.',
    placeholder: '0000003100012345678901',
    validate: (v) => (/^\d{22}$/.test(digits(v)) ? null : 'Enter all 22 digits to continue.'),
    banks: ['Banco Nación', 'Galicia', 'Santander Argentina', 'Mercado Pago', 'Ualá'],
    dialCode: '+54',
  },
  EUR: {
    label: 'IBAN',
    hint: 'Starts with a two-letter country code.',
    placeholder: 'ES91 2100 0418 4502 0005 1332',
    validate: (v) => (/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(digits(v).toUpperCase()) ? null : 'Enter a valid IBAN.'),
    banks: ['Any SEPA bank'],
    dialCode: '+34',
  },
}

export function formatClabe(v: string) {
  const d = digits(v).slice(0, 18)
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 17), d.slice(17)].filter(Boolean).join(' ')
}
