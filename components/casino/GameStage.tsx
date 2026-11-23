'use client'

import { motion, useReducedMotion } from 'motion/react'

const european = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]
const red = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
const wheel = ['0×', '1.5×', '0×', '2×', '0×', '1.5×', '0×', '3.5×', '0×', '1.5×', '0×', '1.75×']

export function Spinner({ roulette, value }: { roulette: boolean; value?: number }) {
  const reducedMotion = useReducedMotion()
  const labels = roulette ? european.map(String) : wheel
  const index = value === undefined ? 0 : roulette ? european.indexOf(value) : value
  const slice = 360 / labels.length
  const colors = labels.map((label, i) => {
    const color = roulette
      ? label === '0'
        ? '#187254'
        : red.has(Number(label))
          ? '#983845'
          : '#252536'
      : label === '0×'
        ? '#2a1c3a'
        : i === 7
          ? '#ae6228'
          : '#754383'
    return color + ' ' + i * slice + 'deg ' + (i + 1) * slice + 'deg'
  })
  return (
    <div className={'round-wheel' + (roulette ? ' roulette-wheel' : '')} aria-hidden="true">
      <div className="wheel-pointer" />
      <motion.div
        className="wheel-face"
        style={{
          background: 'conic-gradient(from ' + -slice / 2 + 'deg,' + colors.join(',') + ')',
        }}
        initial={reducedMotion || value === undefined ? false : { rotate: 0 }}
        animate={{ rotate: value === undefined ? 0 : 720 - index * slice }}
        transition={{ duration: value === undefined ? 0 : 1.15, ease: 'easeOut' }}
      >
        {labels.map((label, i) => (
          <span key={i} style={{ transform: 'rotate(' + i * slice + 'deg)' }}>
            <b>{label}</b>
          </span>
        ))}
        <div className="wheel-hub" />
      </motion.div>
    </div>
  )
}

export function DiceTrack({ target, roll }: { target: number; roll?: number }) {
  return (
    <div className="dice-track" aria-hidden="true">
      <div className="track-scales">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
      <div className="track-bar" style={{ '--target': target + '%' } as React.CSSProperties}>
        <span className="track-target" style={{ left: target + '%' }} />
        {roll !== undefined && (
          <motion.strong
            initial={{ left: '50%' }}
            animate={{ left: Math.min(94, Math.max(6, roll)) + '%' }}
            transition={{ duration: 0.36 }}
          >
            {roll.toFixed(2)}
          </motion.strong>
        )}
      </div>
      <p>
        Roll under <strong>{target}</strong>
      </p>
    </div>
  )
}

export function CoinStage({ face, round }: { face?: string; round: number }) {
  const reducedMotion = useReducedMotion()
  return (
    <div className="coin-table" aria-hidden="true">
      <motion.div
        key={round}
        className="coin-stage coin-two-sided"
        initial={round && !reducedMotion ? { rotateY: 0, scale: 0.87 } : false}
        animate={{ rotateY: round ? (face === 'Tails' ? 900 : 720) : 0, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.78 }}
      >
        <div className="coin-face">
          <span>✦</span>
          <small>Heads</small>
        </div>
        <div className="coin-face coin-reverse">
          <span>☾</span>
          <small>Tails</small>
        </div>
      </motion.div>
    </div>
  )
}

export function LimboStage({ outcome, target }: { outcome?: string; target: string }) {
  return (
    <div className="limbo-stage" aria-hidden="true">
      <div className="limbo-grid" />
      <motion.div
        className="limbo-reading"
        initial={outcome ? { opacity: 0, y: 18 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.43 }}
      >
        <small>{outcome ? 'Final multiplier' : 'Target multiplier'}</small>
        <strong>{outcome || (target || '–') + '×'}</strong>
      </motion.div>
      {outcome && <small>Target {target}×</small>}
    </div>
  )
}
