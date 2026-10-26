import { Skeleton } from "@/components/ui/skeleton";

export default function WalletLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-4 w-56 rounded-md" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-10 w-48 rounded-xl" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-28 rounded-md" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-3 w-12 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}