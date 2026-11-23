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
  const [side, setSide] = useState(
    game.id === 'roulette' ? 'Red' : game.id === 'baccarat' ? 'Player' : 'Heads',
  )
  const [numbers, setNumbers] = useState<number[]>([])
  const choices =
    game.id === 'coin'
      ? ['Heads', 'Tails']
      : game.id === 'roulette'
        ? ['Red', 'Black', 'Zero']
        : game.id === 'baccarat'
          ? ['Player', 'Banker', 'Tie']
          : []
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
      let setting: unknown = side
      if (game.id === 'dice') setting = target
      if (game.id === 'keno') setting = numbers
      if (game.id === 'limbo') {
        setting = /^\d{1,3}(\.\d{1,2})?$/.test(limbo)
          ? Number(whole + fraction.padEnd(2, '0'))
          : null
      }
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
    roulette: 'Spin roulette',
    keno: 'Draw numbers',
    wheel: 'Spin wheel',
    baccarat: 'Deal cards',
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
          {choices.length > 0 && (
            <div className="segmented">
              {choices.map((value) => (
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
              disabled={
                busy || !state || state.paused || (game.id === 'keno' && numbers.length !== 5)
              }
              onClick={() => send('play')}
            >
              {busy ? 'Resolving…' : buttonText[game.id]}
            </button>
          )}
          {state?.paused && <small>New wagers are paused.</small>}
          <p className="game-rule">
            <CircleHelp size={15} />
            {game.subtitle}.
            {game.id === 'keno' && ' Gross returns for 2–5 matches: 1.5×, 6.5×, 20×, 125×.'}
            {game.id === 'wheel' &&
              ' Twelve equally likely segments: six blanks, three 1.5× returns, plus 1.75×, 2× and 3.5×.'}
            {game.id === 'roulette' && ' Gross return: 2× for a color and 36× for zero.'}
            {game.id === 'baccarat' &&
              ' Gross returns: Player 2×, Banker 1.95×, Tie 9×. A tie returns a Player or Banker stake.'}
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
          ) : game.id === 'keno' ? (
            <div className="keno-board">
              <p>{numbers.length} of 5 selected</p>
              <div className="keno-grid">
                {Array.from({ length: 40 }, (_, i) => i + 1).map((number) => (
                  <button
                    key={number}
                    aria-pressed={numbers.includes(number)}
                    data-drawn={result?.board?.includes(number)}
                    disabled={busy || (numbers.length === 5 && !numbers.includes(number))}
                    onClick={() => {
                      setResult(undefined)
                      setNumbers(
                        numbers.includes(number)
                          ? numbers.filter((value) => value !== number)
                          : [...numbers, number],
                      )
                    }}
                  >
                    {number}
                  </button>
                ))}
              </div>
            </div>
          ) : game.id === 'baccarat' && result?.hand ? (
            <div className="baccarat-hands">
              {(['player', 'banker'] as const).map((name) => (
                <div key={name}>
                  <strong>
                    {name === 'player' ? 'Player' : 'Banker'} ·{' '}
                    {name === 'player' ? result.hand!.playerTotal : result.hand!.bankerTotal}
                  </strong>
                  <div>
                    {result.hand![name].map((card, index) => (
                      <span key={index} data-red={Math.floor(card / 13) % 2 === 1}>
                        {
                          ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][
                            card % 13
                          ]
                        }
                        {['♠', '♥', '♣', '♦'][Math.floor(card / 13)]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : game.id === 'wheel' || game.id === 'roulette' ? (
            <motion.div
              key={animation}
              className={'spin-display cover-' + game.id}
              initial={animation ? { rotate: -120, scale: 0.85 } : false}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.42 }}
              aria-hidden="true"
            >
              <strong>
                {game.id === 'roulette' ? (result?.board?.[0] ?? '·') : (result?.message ?? '·')}
              </strong>
            </motion.div>
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
