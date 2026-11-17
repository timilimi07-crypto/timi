import { Skeleton } from "@/components/ui/skeleton";

/** Platzhalter beim Wechsel in den Posteingang (gleiches Raster wie die echte Ansicht). */
export default function Loading() {
  return (
    <div className="flex h-full min-h-0">
      <div className="w-full border-r lg:w-[440px] xl:w-[480px]">
        <div className="flex h-12 items-center border-b px-3">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-2 border-b p-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-7 w-3/4" />
        </div>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="space-y-1.5 border-b px-4 py-3">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="hidden flex-1 space-y-4 p-6 lg:block">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
