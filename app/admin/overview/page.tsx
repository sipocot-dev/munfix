import type { Metadata } from "next";
import Alert from "@/components/ui/Alert";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { requirePagePermission } from "@/lib/guards";
import { getOverview, type Overview } from "@/lib/overview";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status";

export const metadata: Metadata = { title: "Overview" };

const dayLabel = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });

function Bars({ rows, empty }: { rows: { label: string; count: number; color?: string }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-fg-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="truncate text-fg-muted">{r.label}</span>
            <span className="font-semibold tabular-nums text-fg">{r.count}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-surface-3" aria-hidden>
            <div className="h-2 rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: r.color ?? "var(--color-chart)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function OverviewPage() {
  await requirePagePermission("/admin/overview", "stats.view");
  // A failed query shows "not available", never a dashboard of zeros.
  const o: Overview | null = await getOverview().catch((err) => {
    console.error("[overview] could not load:", err instanceof Error ? err.message : err);
    return null;
  });

  return (
    <>
      <PageHeader title="Overview" description="How reports are moving through the municipality. Counts include every status, published or not." />

      {!o && (
        <Alert tone="warning" className="mb-6" title="The figures could not be loaded">
          Refresh the page in a moment. If it keeps happening, check System.
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total reports" value={o?.total ?? null} icon="inbox" />
        <StatCard label="Waiting for review" value={o?.openQueue ?? null} icon="clock" accent="#6d28d9" hint="Submitted or under review" />
        <StatCard
          label="Average days to resolve"
          value={o ? (o.avgResolutionDays === null ? "—" : o.avgResolutionDays.toFixed(1)) : null}
          hint={o && o.avgResolutionDays === null ? "No resolved reports yet" : "From submission to resolved"}
          icon="check"
          accent="#15803d"
        />
      </div>

      {o && (
        <>
          <section className="card mt-6 p-5 sm:p-6" aria-labelledby="daily-title">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="daily-title" className="text-lg font-semibold">
                New reports per day
              </h2>
              <p className="text-sm text-fg-muted">
                Last 30 days · {o.daily.reduce((n, d) => n + d.count, 0)} in total
              </p>
            </div>
            <DailyChart daily={o.daily} />
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <section className="card p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">By status</h2>
              <Bars rows={o.byStatus.map((s) => ({ label: STATUS_LABEL[s.status], count: s.count, color: STATUS_COLOR[s.status] }))} empty="No reports yet." />
            </section>
            <section className="card p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">By category</h2>
              <Bars rows={o.byCategory.map((c) => ({ label: c.name, count: c.count }))} empty="No reports yet." />
            </section>
            <section className="card p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">Top barangays</h2>
              <Bars rows={o.topBarangays.map((b) => ({ label: b.barangay, count: b.count }))} empty="No report has a barangay yet." />
            </section>
          </div>
        </>
      )}
    </>
  );
}

function DailyChart({ daily }: { daily: Overview["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  const label = (day: string) => dayLabel.format(new Date(`${day}T00:00:00Z`));
  return (
    <>
      <div className="mt-5 flex h-40 items-end gap-[3px] border-b border-line" aria-hidden>
        {daily.map((d) => (
          <div key={d.day} title={`${label(d.day)}: ${d.count}`} className="group relative flex h-full flex-1 items-end">
            <div className={`w-full rounded-t-sm ${d.count ? "bg-chart group-hover:bg-primary-hover" : "bg-surface-3"}`} style={{ height: d.count ? `${Math.max(6, (d.count / max) * 100)}%` : "3px" }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-fg-muted" aria-hidden>
        <span>{daily[0] && label(daily[0].day)}</span>
        <span>Peak: {max === 1 && daily.every((d) => d.count === 0) ? 0 : max} per day</span>
        <span>{daily.at(-1) && label(daily.at(-1)!.day)}</span>
      </div>
      {/* The same numbers as a table, for screen readers and anyone who wants exact values. */}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-accent">Show as a table</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead className="text-xs uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="py-1">Day</th>
              <th className="py-1 text-right">Reports</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {daily.map((d) => (
              <tr key={d.day}>
                <td className="py-1">{label(d.day)}</td>
                <td className="py-1 text-right tabular-nums">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
