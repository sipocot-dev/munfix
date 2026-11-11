import Explorer from "@/components/Explorer";
import { MUNICIPALITY } from "@/lib/config";
import { getStats, listCategories, listPublicReports } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Each part loads on its own: if stats fail, the map and reports still show.
  let degraded = false;
  const fail = <T,>(what: string, fallback: T) => (err: unknown) => {
    degraded = true;
    console.error(`[home] could not load ${what}:`, err instanceof Error ? err.message : err);
    return fallback;
  };
  const [reports, stats, categories] = await Promise.all([
    listPublicReports({ limit: 500 }).catch(fail("reports", [] as Awaited<ReturnType<typeof listPublicReports>>)),
    getStats().catch(fail("stats", { verified: 0, inProgress: 0, resolved: 0, avgResolutionDays: null })),
    listCategories().catch(fail("categories", [] as Awaited<ReturnType<typeof listCategories>>)),
  ]);

  return (
    <>
      {degraded && (
        <p role="alert" className="absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-md">
          Reports could not be loaded right now. Please refresh in a moment.
        </p>
      )}
      <h1 className="sr-only">
        {MUNICIPALITY.name}, {MUNICIPALITY.province}: report problems and watch them get fixed
      </h1>
      <Explorer initialReports={reports} categories={categories} stats={stats} />
    </>
  );
}
