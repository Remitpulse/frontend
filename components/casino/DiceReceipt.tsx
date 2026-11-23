'use client'

import { useState } from 'react'
import { verifyDiceProof, type DiceProof } from '@/lib/casino/dice-proof'
import { xlm } from '@/lib/casino/money'

export function DiceReceipt({ proof }: { proof: DiceProof }) {
  const [status, setStatus] = useState('')
  const [recorded, setRecorded] = useState('')
  const receipt = JSON.stringify(proof, null, 2)
  return (
    <details>
      <summary>Dice proof</summary>
      <p>
        Roll {(proof.roll / 100).toFixed(2)} · Win below {proof.target} · Stake {xlm(proof.stake)}{' '}
        XLM
      </p>
      <label>
        Commitment saved before the roll (optional)
        <input
          value={recorded}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setRecorded(event.target.value)
            setStatus('')
          }}
        />
      </label>
      <button
        type="button"
        className="button outlined"
        onClick={async () => {
          const expected = recorded.trim()
          if (expected && expected !== proof.commitment) {
            setStatus('The receipt does not match your saved commitment.')
            return
          }
          try {
            setStatus(
              (await verifyDiceProof(proof))
                ? expected
                  ? 'Saved commitment, roll and payout match.'
                  : 'Receipt commitment, roll and payout match.'
                : 'Proof did not match.',
            )
          } catch {
            setStatus('This browser could not verify the proof.')
          }
        }}
      >
        Verify roll and payout
      </button>
      <p role="status">{status}</p>
      <details>
        <summary>Proof data</summary>
        <textarea readOnly aria-label="Dice proof JSON" value={receipt} />
        <a
          className="button outlined"
          download={`dice-receipt-${proof.commitment.slice(0, 12)}.json`}
          href={'data:application/json;charset=utf-8,' + encodeURIComponent(receipt)}
        >
          Download receipt
        </a>
      </details>
    </details>
  )
}
