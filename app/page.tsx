import Explorer from "@/components/Explorer";
import Alert from "@/components/ui/Alert";
import { getStats, listCategories, listPublicReports } from "@/lib/reports";
import { filtersFromQuery } from "@/lib/explorer";

export const dynamic = "force-dynamic";

type Search = { status?: string; category?: string; q?: string };

export default async function HomePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;

  // Each part loads on its own: if stats fail, the map and reports still show.
  let degraded = false;
  const fail = <T,>(what: string, fallback: T) => (err: unknown) => {
    degraded = true;
    console.error(`[home] could not load ${what}:`, err instanceof Error ? err.message : err);
    return fallback;
  };
  const [reports, stats, categories] = await Promise.all([
    listPublicReports({ limit: 500 }).catch(fail("reports", [] as Awaited<ReturnType<typeof listPublicReports>>)),
    // null, not zeros: a failed load must not look like "nothing reported".
    getStats().catch(fail("stats", null)),
    listCategories().catch(fail("categories", [] as Awaited<ReturnType<typeof listCategories>>)),
  ]);

  return (
    <>
      {degraded && (
        <div className="absolute left-1/2 top-20 z-20 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 shadow-[var(--shadow-raised)]">
          <Alert tone="warning" title="Some information could not be loaded">
            The map may be incomplete. Please refresh in a moment.
          </Alert>
        </div>
      )}
      <Explorer
        initialReports={reports}
        categories={categories}
        stats={stats}
        // From the URL so a filtered view can be shared.
        initialFilters={filtersFromQuery(sp, categories.map((c) => c.slug))}
      />
    </>
  );
}
