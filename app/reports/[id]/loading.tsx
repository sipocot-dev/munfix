import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="container-page" role="status" aria-label="Loading report">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-5 h-4 w-40" />
      <Skeleton className="mt-3 h-9 w-3/4 max-w-xl" />
      <Skeleton className="mt-4 h-6 w-64" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
