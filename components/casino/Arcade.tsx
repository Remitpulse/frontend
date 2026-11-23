'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, MotionConfig } from 'motion/react'
import {
  ArrowDownToLine,
  CircleHelp,
  Coins,
  Dice5,
  Gamepad2,
  History,
  House,
  Layers3,
  Star,
  Trophy,
  Play as PlayIcon,
  Orbit,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react'
import { gameGroups, games, type CasinoState, type Game } from '@/lib/casino/catalog'
import { xlm } from '@/lib/casino/money'
import { Passkeys } from './Passkeys'
import { Play } from './Play'
import { Sportsbook, type SportsMarket } from './Sportsbook'
import { Vault } from './Vault'

export type Result = {
  state: CasinoState
  message?: string
  payout?: string
  path?: number[]
  mines?: number[]
  safe?: number[]
  bust?: boolean
  hash?: string
  xdr?: string
  options?: unknown
  sports?: SportsMarket
  board?: number[]
  hand?: {
    player: number[]
    banker: number[]
    playerTotal: number
    bankerTotal: number
    winner: string
  }
}

export async function casino(input?: Record<string, unknown>): Promise<Result> {
  const response = await fetch(
    '/api/casino',
    input
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      : {},
  )
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Casino request failed.')
  return result
}

type View = 'lobby' | 'activity' | 'sports'
type Category = 'All games' | keyof typeof gameGroups | 'Favorites'
const categories: Category[] = ['All games', 'Arcade', 'Tables', 'Draws', 'Favorites']

export function Arcade() {
  const [state, setState] = useState<CasinoState>()
  const [view, setView] = useState<View>('lobby')
  const [category, setCategory] = useState<Category>('All games')
  const [favorites, setFavorites] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [game, setGame] = useState<Game>()
  const [panel, setPanel] = useState<'wallet' | 'help'>()
  const [issue, setIssue] = useState('')
  const [pausing, setPausing] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef<Promise<Result> | null>(null)
  const heading = useRef<HTMLElement>(null)

  useEffect(() => {
    request.current ??= casino()
    request.current.then(
      (result) => {
        setState(result.state)
        try {
          const saved: unknown = JSON.parse(localStorage.getItem('arcade-favorites') || '[]')
          if (Array.isArray(saved))
            setFavorites(saved.filter((id): id is string => typeof id === 'string'))
        } catch {
          /* preferences are optional */
        }
      },
      (error) => setIssue(error.message),
    )
  }, [])

  useEffect(() => {
    if (game || panel) dialog.current?.showModal()
    else dialog.current?.close()
  }, [game, panel])

  const act = useCallback(async (input: Record<string, unknown>) => {
    try {
      const result = await casino(input)
      if (result.state) setState(result.state)
      return result
    } catch (error) {
      try {
        setState((await casino()).state)
      } catch {
        /* retain known balance */
      }
      throw error
    }
  }, [])

  function close() {
    setGame(undefined)
    setPanel(undefined)
  }

  function navigate(next: View) {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function discover() {
    heading.current?.scrollIntoView({ block: 'start' })
    heading.current?.focus({ preventScroll: true })
  }

  function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((value) => value !== id)
      : [...favorites, id]
    setFavorites(next)
    try {
      localStorage.setItem('arcade-favorites', JSON.stringify(next))
    } catch {
      /* storage can be disabled */
    }
  }

  const recent = Array.from(
    new Set(state?.entries.filter((entry) => entry.kind === 'Wager').map((entry) => entry.game)),
  )
    .flatMap((title) => games.find((item) => item.title === title) ?? [])
    .slice(0, 4)
  const filtered = games.filter((item) => {
    const group: readonly string[] =
      category === 'All games' ? [] : category === 'Favorites' ? favorites : gameGroups[category]
    return (
      (category === 'All games' || group.includes(item.id)) &&
      (item.title + ' ' + item.subtitle).toLowerCase().includes(query.trim().toLowerCase())
    )
  })
  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <button
          className="wordmark"
          onClick={() => navigate('lobby')}
          aria-label="RemitPulse lobby"
        >
          <span className="brand-icon">
            <Orbit size={20} />
          </span>
          <span>
            Remit<span className="brand-accent">Pulse</span>
          </span>
        </button>
        <div className="top-actions">
          <span className="network">
            <i /> <span>Stellar Testnet</span>
          </span>
          <button
            className="balance"
            onClick={() => navigate('activity')}
            aria-label={state ? xlm(state.demo) + ' XLM demo balance' : 'Demo balance'}
          >
            <Coins size={17} />
            <span>
              {state ? xlm(state.demo) : '–'} <small>XLM</small>
            </span>
            <small className="demo-label">DEMO</small>
          </button>
          <button
            className="button primary wallet-button"
            aria-label="Wallet"
            onClick={() => setPanel('wallet')}
          >
            <Wallet size={17} /> <span>Wallet</span>
          </button>
        </div>
      </header>
      <aside className="rail">
        <nav aria-label="Arcade">
          <span className="rail-label">ARCADE</span>
          <button
            aria-current={view === 'lobby' ? 'page' : undefined}
            onClick={() => navigate('lobby')}
          >
            <House size={18} /> Lobby
          </button>
          <button
            aria-current={view === 'sports' ? 'page' : undefined}
            onClick={() => navigate('sports')}
          >
            <Trophy size={18} /> Sports
          </button>
          <button
            aria-current={view === 'activity' ? 'page' : undefined}
            onClick={() => navigate('activity')}
          >
            <History size={18} /> Activity
          </button>
          <button onClick={() => setPanel('wallet')}>
            <Wallet size={18} /> Wallet
          </button>
          <span className="rail-label support">SUPPORT</span>
          <button onClick={() => setPanel('help')}>
            <CircleHelp size={18} /> Play safely
          </button>
        </nav>
        <div className="rail-note">
          <ShieldCheck size={19} />
          <div>
            <strong>Demo environment</strong>
            <span>Simulated wagers</span>
          </div>
        </div>
      </aside>
      <main id="main" className="workspace">
        {issue && (
          <p className="notice" role="alert">
            {issue} <button onClick={() => window.location.reload()}>Reload</button>
          </p>
        )}
        {view === 'lobby' ? (
          <>
            <div className="lobby-masthead">
              <section className="hero">
                <motion.div
                  className="hero-copy"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                >
                  <p className="eyebrow">
                    <Orbit size={16} /> THE STELLAR ARCADE
                  </p>
                  <h1>
                    Play in a<br />
                    <em>different orbit.</em>
                  </h1>
                  <p className="hero-description">
                    Every wager in XLM.
                    <br className="desktop-break" /> Explore the arcade with a free demo balance.
                  </p>
                  <button className="button primary hero-button" onClick={discover}>
                    <Gamepad2 size={18} /> Explore games
                  </button>
                </motion.div>
              </section>
              <aside className="lobby-feature" aria-label="Featured games">
                <p className="eyebrow">
                  <Star size={15} /> Featured games
                </p>
                {([games[5], games[6]] as const).map((item) => (
                  <button
                    key={item.id}
                    className={'feature-card cover-' + item.id}
                    onClick={() => setGame(item)}
                  >
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                    </span>
                    <PlayIcon size={20} />
                  </button>
                ))}
              </aside>
            </div>
            {recent.length > 0 && (
              <section className="recent-games" aria-labelledby="recent-heading">
                <h2 id="recent-heading">Recently played</h2>
                <div>
                  {recent.map((item) => (
                    <button
                      key={item.id}
                      className={'cover-' + item.id}
                      onClick={() => setGame(item)}
                    >
                      <i aria-hidden="true" />
                      {item.title}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section className="lobby" ref={heading} tabIndex={-1} aria-labelledby="lobby-heading">
              <div className="section-title">
                <div>
                  <h2 id="lobby-heading">Game lobby</h2>
                  <p role="status">
                    {filtered.length} {filtered.length === 1 ? 'game' : 'games'} · Simulated XLM
                  </p>
                </div>
                <label className="search">
                  <Search size={17} />
                  <input
                    type="search"
                    aria-label="Search games"
                    placeholder="Search games"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="categories" aria-label="Game categories">
                {categories.map((option, index) => {
                  const Icon = [Gamepad2, Dice5, Layers3, Orbit, Star][index]
                  return (
                    <button
                      key={option}
                      aria-pressed={category === option}
                      onClick={() => setCategory(option)}
                    >
                      <Icon size={16} />
                      {option}
                    </button>
                  )
                })}
              </div>
              {filtered.length ? (
                <div className="games">
                  {filtered.map((item) => (
                    <article className={'game-tile cover-' + item.id} key={item.id}>
                      <button className="game-card" onClick={() => setGame(item)}>
                        <span className="game-art" aria-hidden="true">
                          <span>{item.mark}</span>
                        </span>
                        <span className="game-info">
                          <strong>{item.title}</strong>
                          <span>{item.subtitle}</span>
                        </span>
                      </button>
                      <button
                        className="favorite-control"
                        aria-label={'Favorite ' + item.title}
                        aria-pressed={favorites.includes(item.id)}
                        onClick={() => toggleFavorite(item.id)}
                      >
                        <Star size={17} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  {category === 'Favorites' && !favorites.length
                    ? 'Star a game to save it here.'
                    : 'No games match your search.'}
                </div>
              )}
            </section>
            <section className="stellar-strip" aria-label="Stellar wallet">
              <span className="strip-icon">
                <Orbit size={23} />
              </span>
              <div>
                <h2>Native to Stellar</h2>
                <p>Connect a Testnet wallet to try native XLM deposits and withdrawals.</p>
              </div>
              <button className="button outlined" onClick={() => setPanel('wallet')}>
                <ArrowDownToLine size={17} /> Open wallet
              </button>
            </section>
          </>
        ) : view === 'sports' ? (
          <Sportsbook state={state} act={act} />
        ) : (
          <section className="activity">
            <p className="eyebrow">
              <History size={16} /> YOUR ARCADE
            </p>
            <h1>Activity</h1>
            <div className="summary-grid">
              <div>
                <span>Demo balance</span>
                <strong>
                  {state ? xlm(state.demo) : '–'} <small>XLM</small>
                </strong>
              </div>
              <div>
                <span>Stellar Testnet balance</span>
                <strong>
                  {state ? xlm(state.testnet) : '–'} <small>XLM</small>
                </strong>
              </div>
            </div>
            <Passkeys active={state?.passkey} act={act} />
            <h2>Ledger history</h2>
            {!state?.entries.length ? (
              <p className="empty">Your ledger activity appears here.</p>
            ) : (
              <ul className="history">
                {state.entries.map((entry) => (
                  <li key={entry.id}>
                    <span>
                      <strong>{entry.game || entry.kind}</strong>
                      <small>
                        {entry.kind} ·{' '}
                        {/^[a-f0-9]{64}$/.test(entry.detail) ? (
                          <a
                            href={'https://stellar.expert/explorer/testnet/tx/' + entry.detail}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Stellar transaction
                          </a>
                        ) : (
                          entry.detail
                        )}
                      </small>
                    </span>
                    <span>
                      <strong>{xlm(entry.amount)} XLM</strong>
                      <small>{new Date(entry.created).toLocaleString()}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <footer>
          <span>RemitPulse · Stellar Testnet</span>
          <button onClick={() => setPanel('help')}>Fairness &amp; responsible play</button>
          <a href="/operator">Operator</a>
        </footer>
      </main>
      <dialog
        ref={dialog}
        aria-label={game?.title || (panel === 'wallet' ? 'Stellar wallet' : 'Responsible play')}
        onClose={close}
        onClick={(e) => {
          if (e.target === dialog.current) close()
        }}
      >
        <div className="dialog-inner">
          <button className="icon-button close-dialog" onClick={close} aria-label="Close dialog">
            <X size={21} />
          </button>
          {game && <Play key={game.id} game={game} state={state} act={act} />}
          {panel === 'wallet' && <Vault state={state} act={act} />}
          {panel === 'help' && (
            <section className="help">
              <p className="eyebrow">
                <ShieldCheck size={17} /> PLAYER CONTROLS
              </p>
              <h2>Play safely</h2>
              <p>
                Wagers use simulated XLM. Simulated XLM has no cash value and cannot be withdrawn.
                Wallet payments use the separate Stellar Testnet balance.
              </p>
              <h3>How outcomes work</h3>
              <p>
                The server draws outcomes using a cryptographic random number generator and writes
                the wager and payout to your ledger. Payouts round down to the nearest stroop.
                Public seed verification is unavailable.
              </p>
              <h3>Pause wagering</h3>
              <p>
                Pause new wagers for this demo session. You can still review activity and cash out
                an eligible open Mines round.
              </p>
              <button
                className="button outlined"
                disabled={state?.paused || pausing || !state}
                onClick={async () => {
                  setPausing(true)
                  try {
                    await act({ action: 'pause' })
                  } catch (error) {
                    setIssue((error as Error).message)
                  } finally {
                    setPausing(false)
                  }
                }}
              >
                {state?.paused ? 'Wagering paused' : 'Pause demo wagering'}
              </button>
            </section>
          )}
        </div>
      </dialog>
    </MotionConfig>
  )
}
