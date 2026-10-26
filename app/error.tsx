'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 py-16 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl backdrop-blur">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-mint/15">
          <span className="text-2xl" role="img" aria-label="Warning">
            ⚠️
          </span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          We hit an unexpected snag while processing your request. Your funds
          and transfers are safe — please try again.
        </p>

        {error.digest ? (
          <p className="mt-4 text-xs text-white/40">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => reset()}
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-royal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-royal/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
        >
          Try again
        </button>

        <p className="mt-6 text-xs text-white/40">
          RemitPulse · Fast, transparent global transfers
        </p>
      </div>
    </main>
  );
}