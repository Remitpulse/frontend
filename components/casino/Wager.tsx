'use client'

import { Minus, Plus } from 'lucide-react'
import { parseXlm, STROOPS, xlm } from '@/lib/casino/money'

const presets = ['0.1', '1', '5', '10', '25']

export function Wager({
  value,
  onChange,
  disabled,
  balance,
}: {
  value: string
  onChange: (value: string) => void
  disabled: boolean
  balance?: string
}) {
  function adjust(operation: (amount: bigint) => bigint) {
    let current = 0n
    try {
      current = parseXlm(value)
    } catch {
      /* use zero for an incomplete input */
    }
    const next = operation(current)
    onChange(xlm(next < 0n ? 0n : next > 100n * STROOPS ? 100n * STROOPS : next, 0))
  }

  return (
    <div className="wager-field">
      <label htmlFor="game-stake">Demo wager</label>
      <div className="wager-amount">
        <span className="wager-currency">XLM</span>
        <input
          id="game-stake"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
        <button
          aria-label="Subtract 1 XLM"
          disabled={disabled}
          onClick={() => adjust((amount) => amount - STROOPS)}
        >
          <Minus size={16} />
        </button>
        <button
          aria-label="Add 1 XLM"
          disabled={disabled}
          onClick={() => adjust((amount) => amount + STROOPS)}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="wager-shortcuts" aria-label="Wager shortcuts">
        {presets.map((preset) => (
          <button
            key={preset}
            disabled={disabled}
            onClick={() => onChange(preset)}
            aria-label={'Set wager to ' + preset + ' XLM'}
          >
            {preset}
          </button>
        ))}
        <button
          disabled={disabled}
          onClick={() => adjust((amount) => amount / 2n)}
          aria-label="Halve wager"
        >
          ½
        </button>
        <button
          disabled={disabled}
          onClick={() => adjust((amount) => amount * 2n)}
          aria-label="Double wager"
        >
          2×
        </button>
      </div>
      <small>Available {balance ? xlm(balance) : '–'} XLM · Max 100 XLM</small>
    </div>
  )
}
