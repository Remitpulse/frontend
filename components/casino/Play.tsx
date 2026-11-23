'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { CircleHelp, Gem, Orbit, CircleDot, Check, X as CloseIcon } from 'lucide-react'
import { type CasinoState, type Game } from '@/lib/casino/catalog'
import { parseXlm, STROOPS, xlm } from '@/lib/casino/money'
import type { Result } from './Arcade'
import { Wager } from './Wager'
import { CoinStage, DiceTrack, LimboStage, Spinner } from './GameStage'

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
  const [mineCount, setMineCount] = useState(3)
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
  const [settledStake, setSettledStake] = useState(0n)
  const [result, setResult] = useState<Result>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [animation, setAnimation] = useState(0)
  const round = state?.round
  const isMines = game.id === 'mines'

  let stake = 0n
  try {
    stake = parseXlm(amount)
  } catch {
    /* keep incomplete input editable */
  }
  const validStake = stake > 0n && stake <= 100n * STROOPS && stake <= BigInt(state?.demo ?? '0')
  const payout = result?.payout === undefined ? undefined : BigInt(result.payout)
  const multiplier = payout !== undefined && settledStake > 0n ? (payout * 100n) / settledStake : 0n
  const multiplierText =
    (multiplier / 100n).toString() + '.' + (multiplier % 100n).toString().padStart(2, '0') + '×'
  const history =
    state?.entries
      .filter((entry) => entry.game === game.title && ['Payout', 'Result'].includes(entry.kind))
      .slice(0, 5) ?? []

  async function send(action: string, tile?: number) {
    setBusy(true)
    setError('')
    try {
      const [whole, fraction = ''] = limbo.split('.')
      let setting: unknown = side
      if (game.id === 'dice') setting = target
      if (isMines) setting = mineCount
      if (game.id === 'keno') setting = numbers
      if (game.id === 'limbo') {
        setting = /^\d{1,3}(\.\d{1,2})?$/.test(limbo)
          ? Number(whole + fraction.padEnd(2, '0'))
          : null
      }
      const resolution = await act({ action, game: game.id, amount, setting, tile })
      setSettledStake(isMines && round ? BigInt(round.stake) : stake)
      setResult(resolution)
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
      <header className="play-header">
        <p className="eyebrow">
          <Orbit size={16} /> XLM ORIGINALS
        </p>
        <h2>{game.title}</h2>
      </header>
      <div className="play-layout">
        <div className="play-controls">
          <Wager
            value={isMines && round ? xlm(round.stake, 0) : amount}
            onChange={setAmount}
            disabled={busy || !!(isMines && round)}
            balance={state?.demo}
          />
          {isMines && (
            <div className="mine-risk">
              <label>
                Mines on the board
                <select
                  value={round?.mineCount ?? mineCount}
                  disabled={busy || !!round}
                  onChange={(e) => {
                    setMineCount(Number(e.target.value))
                    setResult(undefined)
                  }}
                >
                  {Array.from({ length: 24 }, (_, index) => index + 1).map((count) => (
                    <option key={count}>{count}</option>
                  ))}
                </select>
              </label>
              <div className="wager-shortcuts" aria-label="Mine count shortcuts">
                {[1, 3, 5, 9, 15, 24].map((count) => (
                  <button
                    key={count}
                    disabled={busy || !!round}
                    aria-label={'Set ' + count + ' mines'}
                    aria-pressed={(round?.mineCount ?? mineCount) === count}
                    onClick={() => {
                      setMineCount(count)
                      setResult(undefined)
                    }}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isMines && round && (
            <small>
              {round.picks.length} of {25 - round.mineCount} safe tiles found
            </small>
          )}
          {game.id === 'dice' && (
            <label>
              Roll under {target}
              <input
                type="range"
                min="2"
                max="98"
                value={target}
                onChange={(e) => {
                  setTarget(Number(e.target.value))
                  setResult(undefined)
                }}
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
                  onChange={(e) => {
                    setLimbo(e.target.value)
                    setResult(undefined)
                  }}
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
                busy ||
                !state ||
                state.paused ||
                !validStake ||
                (game.id === 'keno' && numbers.length !== 5)
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
          <div className="stage-status">
            <span>
              <CircleDot size={13} />{' '}
              {busy
                ? 'Resolving'
                : round && isMines
                  ? 'Round active'
                  : result
                    ? 'Round result'
                    : 'Table open'}
            </span>
            <span>Simulated XLM</span>
          </div>
          {isMines && round?.nextPayout && (
            <div className="mine-returns">
              <span>
                Cash out <strong>{round.picks.length ? xlm(round.payout) : '–'} XLM</strong>
              </span>
              <span>
                Next gem <strong>{xlm(round.nextPayout)} XLM</strong>
              </span>
            </div>
          )}
          <div className="stage-board">
            {isMines ? (
              <div className="tiles">
                {Array.from({ length: 25 }, (_, index) => {
                  const gem = round?.picks.includes(index) ?? result?.safe?.includes(index)
                  const mine = !round && result?.mines?.includes(index)
                  const unpicked = !round && !!result?.mines && !gem && !mine
                  return (
                    <button
                      key={index}
                      className={gem ? 'gem' : mine ? 'mine' : unpicked ? 'unpicked' : ''}
                      disabled={!round || busy || !!gem || state?.paused}
                      aria-label={`Tile ${index + 1}${gem ? ', gem' : mine ? ', mine' : ''}`}
                      onClick={() => send('reveal', index)}
                    >
                      <span className="tile-icon" aria-hidden="true">
                        {gem || unpicked ? <Gem size={20} /> : mine ? '✹' : '◇'}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : game.id === 'keno' ? (
              <div className="keno-board">
                <p>{numbers.length} of 5 selected</p>
                {result?.board && (
                  <div className="keno-draw" aria-label="Draw order">
                    {result.board.map((number, index) => (
                      <motion.span
                        key={number}
                        initial={{ opacity: 0, scale: 0.75 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.07 }}
                        data-match={numbers.includes(number)}
                      >
                        {number}
                      </motion.span>
                    ))}
                  </div>
                )}
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
            ) : game.id === 'baccarat' ? (
              <Baccarat key={animation} hand={result?.hand} />
            ) : game.id === 'wheel' || game.id === 'roulette' ? (
              <Spinner
                key={animation}
                roulette={game.id === 'roulette'}
                value={result?.board?.[0]}
              />
            ) : game.id === 'dice' ? (
              <DiceTrack
                key={animation}
                target={target}
                roll={result?.message ? Number(result.message) : undefined}
              />
            ) : game.id === 'limbo' ? (
              <LimboStage key={animation} outcome={result?.message} target={limbo} />
            ) : game.id === 'coin' ? (
              <CoinStage face={result?.message} round={animation} />
            ) : (
              <Plinko key={animation} path={result?.path} />
            )}
          </div>
          <div className="outcome" aria-live="polite" aria-atomic="true">
            {payout !== undefined || result?.bust ? (
              <motion.div
                key={animation}
                className="round-receipt"
                data-profit={payout !== undefined && payout > settledStake}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.22 }}
              >
                {payout !== undefined && payout > 0n ? (
                  <Check size={23} />
                ) : (
                  <CloseIcon size={21} />
                )}
                <div>
                  <strong>
                    {payout && payout > 0n ? multiplierText + ' return' : 'Round complete'}
                  </strong>
                  <span>{result?.message}</span>
                </div>
                <b>Payout {xlm(payout ?? 0n)} XLM</b>
              </motion.div>
            ) : (
              <strong>
                {result?.message || (round && isMines ? 'Choose a tile' : 'Ready to play')}
              </strong>
            )}
            {error && (
              <span className="error-text" role="alert">
                {error}
              </span>
            )}
          </div>
          <div className="round-history" aria-label="Recent outcomes">
            <span>Recent rounds</span>
            {history.length ? (
              history.map((entry) => (
                <span
                  className="history-pill"
                  key={entry.id}
                  data-paid={entry.kind === 'Payout'}
                  title={entry.detail}
                >
                  {xlm(entry.amount)} XLM
                </span>
              ))
            ) : (
              <small>No completed rounds</small>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Baccarat({ hand }: { hand?: Result['hand'] }) {
  return (
    <div className="baccarat-hands">
      {(['player', 'banker'] as const).map((side, lane) => (
        <div key={side} data-winner={hand?.winner.toLowerCase() === side}>
          <strong>
            {lane ? 'Banker' : 'Player'}{' '}
            {hand && ' · ' + (lane ? hand.bankerTotal : hand.playerTotal)}
          </strong>
          <div>
            {(hand?.[side] ?? [-1, -1]).map((card, index) => {
              const suit = ['♠', '♥', '♣', '♦'][Math.floor(card / 13)]
              return (
                <motion.span
                  key={index}
                  data-back={card === -1}
                  data-red={suit === '♥' || suit === '♦'}
                  initial={hand ? { opacity: 0, y: -10 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: hand ? (index * 2 + lane) * 0.09 : 0 }}
                >
                  {card < 0 ? (
                    '✧'
                  ) : (
                    <>
                      <b>
                        {
                          ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][
                            card % 13
                          ]
                        }
                      </b>
                      <i>{suit}</i>
                    </>
                  )}
                </motion.span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function Plinko({ path }: { path?: number[] }) {
  const positions = [{ x: 50, y: 3 }]
  path?.forEach((step, index) => {
    positions.push({ x: positions[index].x + (step ? 50 / 9 : -50 / 9), y: 12 + index * 10.3 })
  })
  if (path) positions.push({ ...positions[positions.length - 1], y: 100 })
  const landing = path?.reduce((sum, step) => sum + step, 0)
  return (
    <div className="plinko" aria-hidden="true">
      <div className="peg-field">
        {Array.from({ length: 8 }, (_, row) => (
          <div className="peg-row" key={row}>
            {Array.from({ length: row + 2 }, (_, pin) => (
              <i
                key={pin}
                style={{
                  left: 50 + (pin - (row + 1) / 2) * (100 / 9) + '%',
                  top: 12 + row * 10.3 + '%',
                }}
              />
            ))}
          </div>
        ))}
        {path && (
          <motion.i
            className="drop"
            initial={{ left: '50%', top: '3%' }}
            animate={{
              left: positions.map((point) => point.x + '%'),
              top: positions.map((point) => point.y + '%'),
            }}
            transition={{ duration: 0.9, ease: 'linear' }}
          />
        )}
      </div>
      <div className="slots">
        {['6', '2.2', '1.2', '.85', '.55', '.85', '1.2', '2.2', '6'].map((slot, index) => (
          <span key={index} data-hit={index === landing}>
            {slot}×
          </span>
        ))}
      </div>
    </div>
  )
}
