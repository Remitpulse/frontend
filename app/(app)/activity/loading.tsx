import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">
          Activity
        </h1>
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, index) => (
            <li
              key={index}
              className="flex items-center gap-4 px-4 py-4 sm:px-6"
            >
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-4 w-16 shrink-0" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}