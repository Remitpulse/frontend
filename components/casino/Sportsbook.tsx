'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Flag, Ticket, Trophy } from 'lucide-react'
import { parseXlm, xlm } from '@/lib/casino/money'
import type { CasinoState } from '@/lib/casino/catalog'
import type { Result } from './Arcade'

type Option = { label: string; selection: number; price: number }
type Event = {
  id: string
  sport: string
  league: string
  home: string
  away: string
  starts: number
  settles: number
  options: Option[]
}
type TicketRow = {
  id: string
  event: string
  label: string
  selectionLabel: string
  stake: string
  payout: string
  price: number
  score: string | null
  state: 'Open' | 'Won' | 'Lost' | 'Void'
  settles: number
}
export type SportsMarket = { events: Event[]; tickets: TicketRow[]; time: number }
const filters = ['All sports', 'Football', 'Basketball', 'Tennis']
const odds = (value: number) => (value / 100).toFixed(2)

export function Sportsbook({
  state,
  act,
}: {
  state?: CasinoState
  act: (input: Record<string, unknown>) => Promise<Result>
}) {
  const [market, setMarket] = useState<SportsMarket>()
  const [filter, setFilter] = useState('All sports')
  const [pick, setPick] = useState<{ event: Event; option: Option }>()
  const [stake, setStake] = useState('1')
  const [busy, setBusy] = useState(false)
  const [issue, setIssue] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(Date.now)
  const slip = useRef<HTMLElement>(null)
  const requestLock = useRef(false)

  const ready = !!state
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    async function refresh() {
      if (requestLock.current) return
      try {
        const result = await act({ action: 'sports-market' })
        if (!cancelled && !requestLock.current && result.sports) setMarket(result.sports)
      } catch (error) {
        if (!cancelled) setIssue((error as Error).message)
      }
    }
    void refresh()
    const refreshTimer = window.setInterval(refresh, 5000)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
      window.clearInterval(clock)
    }
  }, [ready, act])

  const latest = market?.events.find((event) => event.id === pick?.event.id)
  const taken = market?.tickets.some((ticket) => ticket.event === pick?.event.id)
  const closed = !latest || latest.starts <= now || taken
  let projected: bigint | undefined
  let validStake = false
  try {
    if (pick) {
      const amount = parseXlm(stake)
      projected = (amount * BigInt(pick.option.price)) / 100n
      validStake = amount > 0n && amount <= 1_000_000_000n && amount <= BigInt(state?.demo ?? '0')
    }
  } catch {
    /* show the empty estimate while typing */
  }

  async function place() {
    if (!pick || requestLock.current || closed || !validStake) return
    requestLock.current = true
    setBusy(true)
    setNotice('')
    setIssue('')
    try {
      const { sports, message } = await act({
        action: 'sports-place',
        event: pick.event.id,
        selection: pick.option.selection,
        price: pick.option.price,
        amount: stake,
      })
      if (sports) setMarket(sports)
      setPick(undefined)
      setNotice(message || 'Demo ticket accepted.')
    } catch (error) {
      setIssue((error as Error).message)
    } finally {
      requestLock.current = false
      setBusy(false)
    }
  }

  const events = market?.events.filter((event) => filter === 'All sports' || event.sport === filter)
  return (
    <section className="sportsbook" aria-labelledby="sports-title">
      <header className="sports-hero">
        <div>
          <p className="eyebrow">
            <Trophy size={17} /> Stellar Sportsbook
          </p>
          <h1 id="sports-title">Matchday</h1>
          <p>
            Football, basketball and tennis. Pick a match winner and track your ticket in simulated
            XLM.
          </p>
        </div>
        <span>
          <Flag size={17} /> Simulated wagers
        </span>
      </header>
      <div className="sports-layout">
        <div className="sports-markets">
          <div className="categories" aria-label="Sports filters">
            {filters.map((sport) => (
              <button key={sport} aria-pressed={filter === sport} onClick={() => setFilter(sport)}>
                {sport}
              </button>
            ))}
          </div>
          {!events && (
            <p className="empty" role="status">
              Loading fixtures…
            </p>
          )}
          {events && (
            <ul className="fixture-list">
              {events.map((event) => {
                const booked = market?.tickets.some((ticket) => ticket.event === event.id)
                return (
                  <li className="fixture" key={event.id}>
                    <div className="fixture-meta">
                      <span>
                        <CalendarDays size={15} /> {event.sport} · {event.league}
                      </span>
                      <time dateTime={new Date(event.starts).toISOString()}>
                        {new Date(event.starts).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    <h2>
                      {event.home} <span>vs</span> {event.away}
                    </h2>
                    <div
                      className="odds-grid"
                      style={{ '--option-count': event.options.length } as React.CSSProperties}
                    >
                      {event.options.map((option) => (
                        <button
                          key={option.selection}
                          aria-pressed={
                            pick?.event.id === event.id &&
                            pick.option.selection === option.selection
                          }
                          disabled={busy || !!booked || event.starts <= now}
                          onClick={() => {
                            setPick({ event, option })
                            setIssue('')
                            setNotice('')
                            if (window.matchMedia('(max-width: 880px)').matches) {
                              slip.current?.scrollIntoView({ block: 'start' })
                              slip.current?.focus({ preventScroll: true })
                            }
                          }}
                        >
                          <span>{option.label}</span>
                          <strong>{odds(option.price)}</strong>
                        </button>
                      ))}
                    </div>
                    <small>
                      {event.id.startsWith('football-data:')
                        ? 'Football data by football-data.org · Simulated odds'
                        : 'Simulated fixture'}
                    </small>
                    {booked && <small>Ticket placed</small>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <aside className="sports-side">
          <section className="slip" aria-labelledby="slip-title" ref={slip} tabIndex={-1}>
            <h2 id="slip-title">
              <Ticket size={20} /> Bet slip
            </h2>
            {pick ? (
              <>
                <p>
                  <strong>{pick.option.label}</strong> · {odds(pick.option.price)}
                </p>
                <p className="muted">
                  {pick.event.home} vs {pick.event.away}
                </p>
                <label>
                  Demo stake
                  <div className="amount-input">
                    <input
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      inputMode="decimal"
                      disabled={busy}
                    />
                    <span>XLM</span>
                  </div>
                </label>
                <div className="slip-return">
                  <span>Potential return</span>
                  <strong>
                    {validStake && projected !== undefined ? xlm(projected) : '–'} XLM
                  </strong>
                </div>
                <button
                  className="button primary"
                  disabled={busy || closed || !validStake || state?.paused}
                  onClick={place}
                >
                  {busy ? 'Placing…' : closed ? 'Market unavailable' : 'Place demo bet'}
                </button>
              </>
            ) : (
              <p className="muted">Choose a price to build your slip.</p>
            )}
            {state?.paused && <p className="muted">Demo wagering is paused.</p>}
            {notice && (
              <p className="sports-notice" role="status">
                {notice}
              </p>
            )}
            {issue && (
              <p className="error-text" role="alert">
                {issue}
              </p>
            )}
          </section>
          <section className="sports-tickets" aria-labelledby="tickets-title">
            <h2 id="tickets-title">Your tickets</h2>
            {!market?.tickets.length ? (
              <p className="muted">Your sports bets will appear here.</p>
            ) : (
              <ul>
                {market.tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <span className="ticket-state" data-state={ticket.state}>
                      {ticket.state}
                    </span>
                    <strong>
                      {ticket.selectionLabel} · {odds(ticket.price)}
                    </strong>
                    <small>{ticket.label}</small>
                    <div>
                      <span>{xlm(ticket.stake)} XLM stake</span>
                      <span>{ticket.score ?? 'Awaiting result'}</span>
                    </div>
                    {ticket.state !== 'Open' && (
                      <div>
                        <span>{ticket.state === 'Void' ? 'Refund' : 'Return'}</span>
                        <strong>{xlm(ticket.payout)} XLM</strong>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </section>
  )
}
