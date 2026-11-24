'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  homeBadge?: string
  awayBadge?: string
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
  revisedScore?: string | null
  revisionObserved?: number | null
  state: 'Open' | 'Won' | 'Lost' | 'Void'
  settles: number
}
export type SportsMarket = {
  events: Event[]
  tickets: TicketRow[]
  time: number
  footballStatus?: 'simulated' | 'unavailable' | 'current'
}
export type DailySchedule = {
  status: 'disabled' | 'unavailable' | 'partial' | 'current'
  fixtures: (Pick<Event, 'id' | 'sport' | 'league' | 'home' | 'away' | 'starts'> & {
    homeBadge?: string
    awayBadge?: string
  })[]
}

function TeamBadge({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false)
  return src && !failed ? (
    // The provider supplies small badge images from CSP-allowlisted hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="fixture-badge"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="fixture-badge" aria-hidden="true">
      {name.trim().slice(0, 2).toUpperCase()}
    </span>
  )
}

const filters = ['All sports', 'Football', 'Basketball', 'Tennis']
const odds = (value: number) => (value / 100).toFixed(2)

export function Sportsbook({
  state,
  act,
  service,
  reconnect,
}: {
  service: 'loading' | 'ready' | 'unavailable'
  reconnect: () => Promise<void>
  state?: CasinoState
  act: (input: Record<string, unknown>) => Promise<Result>
}) {
  const [schedule, setSchedule] = useState<DailySchedule>()
  const [scheduleRetry, setScheduleRetry] = useState(0)
  const [market, setMarket] = useState<SportsMarket>()
  const [filter, setFilter] = useState('All sports')
  const [pick, setPick] = useState<{ event: Event; option: Option }>()
  const [stake, setStake] = useState('1')
  const [busy, setBusy] = useState(false)
  const [issue, setIssue] = useState('')
  const [refreshIssue, setRefreshIssue] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(Date.now)
  const [sheetOpen, setSheetOpen] = useState(false)
  const requestLock = useRef(false)

  const [refreshVersion, setRefreshVersion] = useState(0)
  const [sheet, setSheet] = useState<HTMLDialogElement | null>(null)
  useEffect(() => {
    if (sheetOpen && sheet && !sheet.open) sheet.showModal()
  }, [sheet, sheetOpen])
  const ready = service === 'ready' && !!state
  const fixturesUnavailable = service === 'unavailable' || !!refreshIssue
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    let refreshing = false
    async function refresh() {
      if (requestLock.current || refreshing) return
      refreshing = true
      try {
        const result = await act({ action: 'sports-market' })
        if (!cancelled && !requestLock.current && result.sports) {
          setMarket(result.sports)
          setRefreshIssue('')
        }
      } catch {
        if (!cancelled && !requestLock.current) setRefreshIssue('Fixtures unavailable.')
      } finally {
        refreshing = false
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
  }, [ready, act, refreshVersion])

  useEffect(() => {
    if (!ready) return
    let active = true
    let pending = false
    async function refreshSchedule() {
      if (pending) return
      pending = true
      try {
        const { schedule } = await act({ action: 'sports-schedule' })
        if (active) setSchedule(schedule)
      } catch {
        if (active) setSchedule({ status: 'unavailable', fixtures: [] })
      } finally {
        pending = false
      }
    }
    void refreshSchedule()
    const timer = window.setInterval(refreshSchedule, 60_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [ready, act, scheduleRetry])

  const latest = market?.events.find((event) => event.id === pick?.event.id)
  const taken = market?.tickets.some((ticket) => ticket.event === pick?.event.id)
  const latestOption = latest?.options.find((option) => option.selection === pick?.option.selection)
  const quoteChanged =
    !!pick &&
    !!latest &&
    (latest.starts !== pick.event.starts || latestOption?.price !== pick.option.price)
  const closed =
    !latest || latest.starts <= now || taken || quoteChanged || !ready || !!refreshIssue
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
        starts: pick.event.starts,
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
  const scheduled = schedule?.fixtures.filter((fixture) => fixture.starts > now) ?? []
  const sportsFilters = [...new Set([...filters, ...scheduled.map((fixture) => fixture.sport)])]
  if (!sportsFilters.includes(filter)) sportsFilters.push(filter)
  const dailyFixtures = scheduled.filter(
    (fixture) => filter === 'All sports' || fixture.sport === filter,
  )
  const footballUnavailable =
    (filter === 'All sports' || filter === 'Football') && market?.footballStatus === 'unavailable'
  const betSlip = (
    <section className="slip" aria-labelledby="slip-title">
      <h2 id="slip-title">
        <Ticket size={20} /> Bet slip
      </h2>
      {sheetOpen && (
        <button className="button outlined slip-close" onClick={() => sheet?.close()}>
          Close slip
        </button>
      )}
      {pick ? (
        <>
          <p>
            <strong>{pick.option.label}</strong> · {odds(pick.option.price)}
          </p>
          <p className="muted">
            {pick.event.home} vs {pick.event.away}
          </p>
          {pick.event.id.startsWith('football-data:') && (
            <p className="muted">
              Settles on the score after regulation time, including stoppage time.
            </p>
          )}
          {quoteChanged && (
            <p role="status">
              Kickoff or odds changed. Select the outcome again to review the updated slip.
            </p>
          )}
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
            <strong>{validStake && projected !== undefined ? xlm(projected) : '–'} XLM</strong>
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
  )
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
            {sportsFilters.map((sport) => (
              <button key={sport} aria-pressed={filter === sport} onClick={() => setFilter(sport)}>
                {sport}
              </button>
            ))}
          </div>
          {schedule && schedule.status !== 'disabled' && (
            <section className="daily-fixtures" aria-label="Worldwide fixtures">
              <h2>Worldwide fixtures</h2>
              <p className="muted">
                Upcoming fixtures for today and tomorrow in UTC. Kickoff times are local.
              </p>
              {(schedule.status === 'unavailable' || schedule.status === 'partial') && (
                <p className="notice" role="status">
                  {schedule.status === 'partial'
                    ? 'Some fixtures are unavailable.'
                    : 'Worldwide fixtures unavailable.'}{' '}
                  <button onClick={() => setScheduleRetry((value) => value + 1)}>
                    Retry schedule
                  </button>
                </p>
              )}
              {dailyFixtures.length === 0 && schedule.status === 'current' && (
                <p className="empty">No upcoming fixtures match this sport.</p>
              )}
              <ul className="fixture-list">
                {dailyFixtures.map((fixture) => (
                  <li className="fixture" key={fixture.id}>
                    <div className="fixture-meta">
                      <span>
                        {fixture.sport} · {fixture.league}
                      </span>
                      <time dateTime={new Date(fixture.starts).toISOString()}>
                        {new Date(fixture.starts).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    <div className="fixture-teams">
                      <span>
                        <TeamBadge
                          key={fixture.homeBadge}
                          name={fixture.home}
                          src={fixture.homeBadge}
                        />
                        {fixture.home}
                      </span>
                      <small>vs</small>
                      <span>
                        <TeamBadge
                          key={fixture.awayBadge}
                          name={fixture.away}
                          src={fixture.awayBadge}
                        />
                        {fixture.away}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <small>Schedule and badges by TheSportsDB</small>
            </section>
          )}
          {schedule && schedule.status !== 'disabled' && (
            <h2 className="daily-market-title">Demo betting markets</h2>
          )}
          {fixturesUnavailable && (
            <p className="notice" role="status">
              Fixtures unavailable.{' '}
              <button
                onClick={() => {
                  if (!ready) void reconnect()
                  else setRefreshVersion((version) => version + 1)
                }}
              >
                Retry fixtures
              </button>
            </p>
          )}
          {!events && !fixturesUnavailable && (
            <p className="empty" role="status">
              Loading fixtures…
            </p>
          )}
          {footballUnavailable && (
            <p className="notice" role="status">
              The football feed is unavailable. New football tickets are paused.
            </p>
          )}
          {events?.length === 0 && !footballUnavailable && !refreshIssue && (
            <p className="empty" role="status">
              No open fixtures match this filter.
            </p>
          )}
          {!!events?.length && (
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
                    <h2 className="fixture-teams">
                      <span>
                        <TeamBadge key={event.homeBadge} name={event.home} src={event.homeBadge} />
                        {event.home}
                      </span>
                      <small>vs</small>
                      <span>
                        <TeamBadge key={event.awayBadge} name={event.away} src={event.awayBadge} />
                        {event.away}
                      </span>
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
                          disabled={
                            busy || !ready || !!refreshIssue || !!booked || event.starts <= now
                          }
                          onClick={() => {
                            setPick({ event, option })
                            setIssue('')
                            setNotice('')
                            if (window.matchMedia('(max-width: 880px)').matches) {
                              setSheetOpen(true)
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
                        ? 'Football data by football-data.org · 90-minute result · Simulated odds'
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
          <dialog
            ref={setSheet}
            className="mobile-slip-sheet"
            aria-label="Sports bet"
            onClose={() => setSheetOpen(false)}
          />
          {sheetOpen && sheet ? createPortal(betSlip, sheet) : betSlip}
          {pick && !sheetOpen && (
            <button
              className="button primary mobile-slip-trigger"
              onClick={() => {
                setSheetOpen(true)
              }}
            >
              Open bet slip
            </button>
          )}
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
                    {ticket.revisedScore && (
                      <small className="sports-notice">
                        Provider revised the regulation score to {ticket.revisedScore}. This ticket
                        still shows its original settlement.
                        {typeof ticket.revisionObserved === 'number' && (
                          <>
                            {' '}
                            Observed{' '}
                            <time dateTime={new Date(ticket.revisionObserved).toISOString()}>
                              {new Date(ticket.revisionObserved).toLocaleString()}
                            </time>
                            .
                          </>
                        )}
                      </small>
                    )}
                    {ticket.state !== 'Open' && (
                      <div>
                        <span>{ticket.state === 'Void' ? 'Refund' : 'Return'}</span>
                        <strong>{xlm(ticket.payout)} XLM</strong>
                        <a
                          download={`sports-ticket-${ticket.id}.json`}
                          href={
                            'data:application/json;charset=utf-8,' +
                            encodeURIComponent(JSON.stringify(ticket, null, 2))
                          }
                        >
                          Download settled ticket
                        </a>
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
