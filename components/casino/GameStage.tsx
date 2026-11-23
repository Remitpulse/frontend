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

export function DiceTrack({ target, roll }: { target: number; roll?: string }) {
  const reducedMotion = useReducedMotion()
  const digits = roll?.replace('.', '') ?? '0000'
  return (
    <div className="dice-arena">
      <div className="dice-felt" aria-hidden="true">
        <div className="dice-rim" />
        <span className="dice-table-mark">STELLAR · PERCENTILE</span>
        <div className="dice-pieces">
          {Array.from(digits, (digit, index) => (
            <div className="dice-piece" key={index} data-fraction={index > 1}>
              {index === 2 && <span className="dice-decimal">.</span>}
              <motion.div
                className="dice-stone"
                initial={
                  roll && !reducedMotion
                    ? { y: -55, x: index % 2 ? 35 : -35, rotate: -170, rotateY: -220, scale: 0.7 }
                    : false
                }
                animate={{
                  y: roll && !reducedMotion ? [-55, 10, -18, 0, -5, 0] : 0,
                  x: 0,
                  rotate: 0,
                  rotateY: 0,
                  scale: 1,
                }}
                transition={{
                  duration: roll && !reducedMotion ? 0.82 : 0,
                  delay: roll && !reducedMotion ? index * 0.055 : 0,
                  ease: 'easeOut',
                }}
              >
                <span className="dice-facet-top" />
                <span className="dice-facet-bottom" />
                <span className="dice-engraving">{roll ? digit : '·'}</span>
              </motion.div>
            </div>
          ))}
        </div>
        <div className="dice-readout">
          <span>{roll ? 'Server roll' : 'Roll range'}</span>
          <strong>{roll ?? '00.00–99.99'}</strong>
        </div>
      </div>
      <div className="dice-probability">
        <div>
          <span>Winning rolls</span>
          <strong>Under {target}</strong>
        </div>
        <div>
          <span>Win chance</span>
          <strong>{target}%</strong>
        </div>
      </div>
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
              initial={reducedMotion ? false : { left: '50%', opacity: 0 }}
              animate={{ left: Math.min(94, Math.max(6, Number(roll))) + '%', opacity: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.24, delay: reducedMotion ? 0 : 0.82 }}
            >
              {roll}
            </motion.strong>
          )}
        </div>
      </div>
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
