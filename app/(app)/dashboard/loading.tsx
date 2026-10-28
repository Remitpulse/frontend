import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Mobile logo header */}
      <div className="flex items-center justify-between md:hidden">
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>

      {/* Greeting heading lines */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48 rounded-md" />
        <Skeleton className="h-4 w-64 rounded-md" />
      </div>

      {/* Balance card */}
      <div className="rounded-2xl bg-navy p-5">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-24 rounded-md bg-white/20" />
          <Skeleton className="h-9 w-40 rounded-md bg-white/20" />
        </div>
        <div className="mt-5 flex gap-3">
          <Skeleton className="h-11 flex-1 rounded-xl bg-white/20" />
          <Skeleton className="h-11 flex-1 rounded-xl bg-white/20" />
        </div>
      </div>

      {/* Send again avatars */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-28 rounded-md" />
        <div className="flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-3 w-12 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Activity rows */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24 rounded-md" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
          >
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}