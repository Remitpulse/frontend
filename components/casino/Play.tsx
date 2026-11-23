'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { CircleHelp, Gem, Orbit } from 'lucide-react'
import { type CasinoState, type Game } from '@/lib/casino/catalog'
import { xlm } from '@/lib/casino/money'
import type { Result } from './Arcade'

export function Play({
  game,
  state,
  act,
}: {
  game: Game
  state?: CasinoState
  act: (input: Record<string, unknown>) => Promise<Result>
}) {
  const [amount, setAmount] = useState('1')
  const [target, setTarget] = useState(50)
  const [limbo, setLimbo] = useState('2.00')
  const [side, setSide] = useState('Heads')
  const [result, setResult] = useState<Result>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [animation, setAnimation] = useState(0)
  const round = state?.round
  const isMines = game.id === 'mines'

  async function send(action: string, tile?: number) {
    setBusy(true)
    setError('')
    try {
      const [whole, fraction = ''] = limbo.split('.')
      const setting =
        game.id === 'dice'
          ? target
          : game.id === 'coin'
            ? side
            : /^\d{1,3}(\.\d{1,2})?$/.test(limbo)
              ? Number(whole + fraction.padEnd(2, '0'))
              : null
      setResult(await act({ action, game: game.id, amount, setting, tile }))
      setAnimation((value) => value + 1)
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const buttonText = {
    dice: 'Roll dice',
    mines: 'Start round',
    plinko: 'Drop ball',
    limbo: 'Launch',
    coin: 'Flip coin',
  }
  return (
    <section
      className={'play play-' + game.id}
      style={{ '--game-color': game.color } as React.CSSProperties}
    >
      <p className="eyebrow">
        <Orbit size={16} /> XLM ORIGINALS
      </p>
      <h2>{game.title}</h2>
      <div className="play-layout">
        <div className="play-controls">
          <label>
            Demo wager{' '}
            <div className="amount-input">
              <input
                type="text"
                inputMode="decimal"
                value={isMines && round ? xlm(round.stake, 0) : amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy || !!(isMines && round)}
              />
              <span>XLM</span>
            </div>
          </label>
          <small>Available {state ? xlm(state.demo) : '–'} XLM</small>
          {game.id === 'dice' && (
            <label>
              Roll under {target}
              <input
                type="range"
                min="2"
                max="98"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                disabled={busy}
              />
            </label>
          )}
          {game.id === 'limbo' && (
            <label>
              Target multiplier
              <div className="amount-input">
                <input
                  value={limbo}
                  onChange={(e) => setLimbo(e.target.value)}
                  inputMode="decimal"
                  disabled={busy}
                />
                <span>×</span>
              </div>
            </label>
          )}
          {game.id === 'coin' && (
            <div className="segmented">
              {['Heads', 'Tails'].map((value) => (
                <button
                  key={value}
                  aria-pressed={side === value}
                  onClick={() => setSide(value)}
                  disabled={busy}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
          {isMines && round ? (
            <button
              className="button primary"
              disabled={busy || !round.picks.length}
              onClick={() => send('cashout')}
            >
              Cash out {round.picks.length ? xlm(round.payout) + ' XLM' : ''}
            </button>
          ) : (
            <button
              className="button primary"
              disabled={busy || !state || state.paused}
              onClick={() => send('play')}
            >
              {busy ? 'Resolving…' : buttonText[game.id]}
            </button>
          )}
          {state?.paused && <small>New wagers are paused.</small>}
          <p className="game-rule">
            <CircleHelp size={15} />
            {game.subtitle}.
          </p>
        </div>
        <div className="play-stage">
          {isMines ? (
            <div className="tiles">
              {Array.from({ length: 25 }, (_, index) => {
                const gem = round?.picks.includes(index)
                const mine = !round && result?.mines?.includes(index)
                return (
                  <button
                    key={index}
                    className={gem ? 'gem' : mine ? 'mine' : ''}
                    disabled={!round || busy || !!gem || state?.paused}
                    aria-label={`Tile ${index + 1}${gem ? ', gem' : mine ? ', mine' : ''}`}
                    onClick={() => send('reveal', index)}
                  >
                    {gem ? <Gem size={22} /> : mine ? '✹' : '·'}
                  </button>
                )
              })}
            </div>
          ) : game.id === 'plinko' ? (
            <Plinko key={animation} path={result?.path} />
          ) : (
            <motion.div
              key={animation}
              className="game-medallion"
              initial={animation ? { scale: 0.78, rotate: -12 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 210 }}
              aria-hidden="true"
            >
              {game.mark}
            </motion.div>
          )}
          <div className="outcome" aria-live="polite">
            <strong>{result?.message || (round ? 'Choose a tile' : 'Ready to play')}</strong>
            {result?.payout !== undefined && <span>Payout {xlm(result.payout)} XLM</span>}
            {error && (
              <span className="error-text" role="alert">
                {error}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Plinko({ path }: { path?: number[] }) {
  const stops = [0]
  for (const step of path ?? []) {
    stops.push(stops[stops.length - 1] + (step ? 17 : -17))
  }
  return (
    <div className="plinko" aria-hidden="true">
      {Array.from({ length: 8 }, (_, row) => (
        <div className="peg-row" key={row}>
          {Array.from({ length: row + 2 }, (_, pin) => (
            <i key={pin} />
          ))}
        </div>
      ))}
      {path && (
        <motion.i
          className="drop"
          initial={{ x: 0, y: 0 }}
          animate={{ x: stops, y: stops.map((_, index) => index * 22) }}
          transition={{ duration: 0.75, ease: 'linear' }}
        />
      )}
      <div className="slots">
        {['6', '2.2', '1.2', '.85', '.55', '.85', '1.2', '2.2', '6'].map((slot, index) => (
          <span key={index} data-hit={path && index === path.reduce((sum, step) => sum + step, 0)}>
            {slot}×
          </span>
        ))}
      </div>
    </div>
  )
}
