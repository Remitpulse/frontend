import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 py-16 text-center">
      <div className="w-full max-w-md rounded-2xl border border-royal/30 bg-navy/60 p-8 shadow-xl backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-widest text-mint">404</p>
        <h1 className="mt-3 text-3xl font-bold text-white">Page not found</h1>
        <p className="mt-4 text-base text-white/70">
          We couldn&apos;t find the page you were looking for. It may have been moved or the link
          might be incorrect.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-mint px-6 py-3 text-sm font-semibold text-navy transition-colors hover:bg-mint/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
