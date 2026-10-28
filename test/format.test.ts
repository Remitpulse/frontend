import { describe, expect, it } from 'vitest'
import {
  formatCountdown,
  formatMoney,
  greeting,
  initials,
  maskAccount,
  shortAddress,
} from '@/lib/format'

describe('formatMoney', () => {
  it('formats numbers and numeric strings with 2 decimals by default', () => {
    expect(formatMoney(1234.5)).toBe('1,234.50')
    expect(formatMoney('1234.5')).toBe('1,234.50')
  })

  it('respects a custom decimals option', () => {
    expect(formatMoney(1, { decimals: 0 })).toBe('1')
    expect(formatMoney(1.2345, { decimals: 4 })).toBe('1.2345')
  })

  it('falls back to 0.00 for non-finite input', () => {
    expect(formatMoney('not a number')).toBe('0.00')
    expect(formatMoney(NaN)).toBe('0.00')
  })
})

describe('formatCountdown', () => {
  it('pads minutes and seconds to two digits', () => {
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(65)).toBe('01:05')
    expect(formatCountdown(600)).toBe('10:00')
  })
})

describe('initials', () => {
  it('uppercases the first letter of first and last name', () => {
    expect(initials('ada', 'lovelace')).toBe('AL')
  })

  it('handles a missing last name', () => {
    expect(initials('ada')).toBe('A')
  })

  it('handles surrounding whitespace', () => {
    expect(initials('  ada  ', '  lovelace  ')).toBe('AL')
  })
})

describe('maskAccount', () => {
  it('masks all but the last 4 digits', () => {
    expect(maskAccount('1234 5678 9012 3456')).toBe('•••• 3456')
  })

  it('returns an empty string for missing input', () => {
    expect(maskAccount(undefined)).toBe('')
    expect(maskAccount('')).toBe('')
  })
})

describe('shortAddress', () => {
  it('truncates addresses longer than 12 characters', () => {
    expect(shortAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe('GABCD…VWXYZ')
  })

  it('leaves short addresses untouched', () => {
    expect(shortAddress('GABC')).toBe('GABC')
  })
})

describe('greeting', () => {
  it('greets morning, afternoon, and evening correctly', () => {
    expect(greeting(new Date(2024, 0, 1, 8))).toBe('Good morning')
    expect(greeting(new Date(2024, 0, 1, 14))).toBe('Good afternoon')
    expect(greeting(new Date(2024, 0, 1, 20))).toBe('Good evening')
  })
})
