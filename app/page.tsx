import Explorer from "@/components/Explorer";
import { MUNICIPALITY } from "@/lib/config";
import { getStats, listCategories, listPublicReports } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // If the database is slow or down, still show the page instead of an error screen.
  let degraded = false;
  const [reports, stats, categories] = await Promise.all([
    listPublicReports({ limit: 500 }),
    getStats(),
    listCategories(),
  ]).catch((err) => {
    degraded = true;
    console.error("[home] could not load reports:", err instanceof Error ? err.message : err);
    return [[], { verified: 0, inProgress: 0, resolved: 0, avgResolutionDays: null }, []] as unknown as [
      Awaited<ReturnType<typeof listPublicReports>>,
      Awaited<ReturnType<typeof getStats>>,
      Awaited<ReturnType<typeof listCategories>>,
    ];
  });

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
