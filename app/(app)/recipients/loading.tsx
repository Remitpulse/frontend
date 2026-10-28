export default function RecipientsLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded-xl bg-navy-100" />
        <div className="h-10 w-32 animate-pulse rounded-xl bg-navy-100" />
      </div>

      <div className="divide-y divide-navy-100 overflow-hidden rounded-2xl border border-navy-100 bg-white">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 px-4 py-4 sm:px-6"
          >
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-navy-100" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="h-4 w-1/3 animate-pulse rounded-md bg-navy-100" />
              <div className="h-3 w-1/2 animate-pulse rounded-md bg-navy-100" />
            </div>
            <div className="h-5 w-5 shrink-0 animate-pulse rounded-md bg-navy-100" />
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="h-11 w-full animate-pulse rounded-xl bg-navy-100" />
      </div>
    </div>
  );
}