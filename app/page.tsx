import Link from "next/link";
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

  const tiles = [
    { label: "Verified", value: stats.verified, hint: "awaiting action", color: "#d97706" },
    { label: "In progress", value: stats.inProgress, hint: "crews on it", color: "#2563eb" },
    { label: "Resolved", value: stats.resolved, hint: "fixed", color: "#16a34a" },
    {
      label: "Avg. time to fix",
      value: stats.avgResolutionDays === null ? "—" : `${stats.avgResolutionDays}d`,
      hint: "from publication",
      color: "#0f766e",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <section className="mb-8 grid items-end gap-6 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
            {MUNICIPALITY.name}, {MUNICIPALITY.province}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">See a problem? Report it. Watch it get fixed.</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Pin potholes, broken streetlights, clogged drains and other infrastructure issues on the map. City staff verify every
            report, and you can follow it from submission to resolution.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/report/new" className="btn btn-primary">
              Report an issue
            </Link>
            <a href="#map" className="btn btn-secondary">
              Browse the map
            </a>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[34rem]">
          {tiles.map((t) => (
            <div key={t.label} className="card p-4">
              <dt className="text-xs font-medium text-slate-500">{t.label}</dt>
              <dd className="mt-1 text-2xl font-bold" style={{ color: t.color }}>
                {t.value}
              </dd>
              <p className="text-xs text-slate-400">{t.hint}</p>
            </div>
          ))}
        </dl>
      </section>

      {degraded && (
        <p role="alert" className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Reports could not be loaded right now. Please refresh in a moment.
        </p>
      )}

      <div id="map" className="scroll-mt-24">
        <Explorer initialReports={reports} categories={categories} />
      </div>
    </div>
  );
}
