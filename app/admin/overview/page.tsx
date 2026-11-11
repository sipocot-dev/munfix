import type { Metadata } from "next";
import AdminNav from "@/components/AdminNav";
import { requirePageRole } from "@/lib/guards";
import { getOverview } from "@/lib/overview";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status";

export const metadata: Metadata = { title: "Overview" };

function Bars({ rows }: { rows: { label: string; count: number; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <p className="text-sm text-slate-500">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between">
            <span>{r.label}</span>
            <span className="font-semibold tabular-nums">{r.count}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: r.color ?? "#1d3557" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function OverviewPage() {
  const session = await requirePageRole("/admin/overview", "moderator", "admin");
  const o = await getOverview();
  const maxDay = Math.max(1, ...o.daily.map((d) => d.count));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
      <p className="mt-2 mb-4 text-slate-600">How reports are moving through the municipality.</p>
      <AdminNav role={session.role} current="/admin/overview" />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-slate-500">Total reports</p><p className="text-3xl font-bold">{o.total}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Waiting for review</p><p className="text-3xl font-bold">{o.openQueue}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Avg. days to resolve</p><p className="text-3xl font-bold">{o.avgResolutionDays === null ? "—" : o.avgResolutionDays.toFixed(1)}</p></div>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="text-lg font-semibold">Reports per day (last 30 days)</h2>
        <div className="mt-4 flex h-32 items-end gap-1" role="img" aria-label="Bar chart of reports submitted per day over the last 30 days">
          {o.daily.map((d) => (
            <div key={d.day} title={`${d.day}: ${d.count}`} className="flex-1 rounded-t bg-ink-600" style={{ height: `${Math.max(d.count ? 6 : 2, (d.count / maxDay) * 100)}%`, opacity: d.count ? 1 : 0.2 }} />
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-semibold">By status</h2>
          <Bars rows={o.byStatus.map((s) => ({ label: STATUS_LABEL[s.status], count: s.count, color: STATUS_COLOR[s.status] }))} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-semibold">By category</h2>
          <Bars rows={o.byCategory.map((c) => ({ label: c.name, count: c.count }))} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-semibold">Top barangays</h2>
          <Bars rows={o.topBarangays.map((b) => ({ label: b.barangay, count: b.count }))} />
        </section>
      </div>
    </div>
  );
}
