import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="operator">
      <h1>Page unavailable</h1>
      <Link href="/">Return to the arcade</Link>
    </main>
  )
}
