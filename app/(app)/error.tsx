'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-full max-w-md rounded-2xl border border-navy-100 bg-white p-8 shadow-sm">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-royal-50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-royal-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86l-8.4 14.55A1 1 0 0 0 2.76 20h18.48a1 1 0 0 0 .87-1.59l-8.4-14.55a1 1 0 0 0-1.74 0z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-navy-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-navy-600">
          We hit an unexpected error while loading this page. Your transfers and
          data are safe — please try again.
        </p>

        {error.digest ? (
          <p className="mt-3 text-xs text-navy-400">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-lg bg-royal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-500 focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-navy-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-700 transition-colors hover:bg-mint-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-500 focus-visible:ring-offset-2"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}