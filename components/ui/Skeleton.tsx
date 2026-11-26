/** Grey placeholder shown while a route streams in. Hidden from assistive tech; loading.tsx announces once. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** Page-shaped skeleton used by the route-level loading.tsx files. */
export function PageSkeleton({ rows = 4, narrow = false, bare = false }: { rows?: number; narrow?: boolean; bare?: boolean }) {
  return (
    <div className={bare ? "" : `container-page ${narrow ? "container-narrow" : ""}`} role="status" aria-label="Loading">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-2/3 max-w-md" />
      <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="card flex gap-4 p-4">
            <Skeleton className="h-16 w-16 flex-none" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
