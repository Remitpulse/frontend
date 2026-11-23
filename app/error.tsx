'use client'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="operator">
      <h1>Arcade unavailable</h1>
      <button className="button outlined" onClick={reset}>
        Try again
      </button>
    </main>
  )
}
