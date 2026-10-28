import { Skeleton } from "@/components/ui/Skeleton";

function RowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <Skeleton className="h-4 w-24 rounded-md" />
      <Skeleton className="h-4 w-32 rounded-md" />
    </div>
  );
}

export default function TransferDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* FlowHeader placeholder */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-3 w-20 rounded-md" />
        </div>
      </div>

      {/* Status tag pill */}
      <div>
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>

      {/* Headline and amount lines */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-3/4 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      {/* Tracker stepper skeleton */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3 w-14 rounded-md" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-5 h-1.5 w-full rounded-full" />
      </div>

      {/* Details card */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <Skeleton className="mb-2 h-5 w-32 rounded-md" />
        <div className="divide-y divide-border">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    </div>
  );
}