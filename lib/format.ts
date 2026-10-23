export function formatMoney(amount: string | number, opts: { decimals?: number } = {}) {
  const n = typeof amount === 'string' ? Number(amount) : amount
  const d = opts.decimals ?? 2
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '0.00'
}

export function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function initials(first: string, last = '') {
  return `${first.trim()[0] ?? ''}${last.trim()[0] ?? ''}`.toUpperCase()
}

export function maskAccount(account?: string) {
  const digits = (account ?? '').replace(/\s/g, '')
  return digits ? `•••• ${digits.slice(-4)}` : ''
}

export function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 5)}…${address.slice(-5)}` : address
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
