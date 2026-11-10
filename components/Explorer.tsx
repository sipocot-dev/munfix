"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Category, ReportSummary } from "@/lib/reports";
import { PUBLIC_STATUSES, STATUS_COLOR, STATUS_LABEL, type Status } from "@/lib/status";
import { formatDate } from "@/lib/format";
import ReportsMap from "./ReportsMap";
import StatusBadge from "./StatusBadge";

export default function Explorer({
  initialReports,
  categories,
}: {
  initialReports: ReportSummary[];
  categories: Category[];
}) {
  const [reports, setReports] = useState(initialReports);
  const [statuses, setStatuses] = useState<Status[]>([...PUBLIC_STATUSES]);
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const first = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    // The server already rendered the unfiltered list.
    if (first.current) {
      first.current = false;
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ limit: "500" });
    if (statuses.length > 0 && statuses.length < PUBLIC_STATUSES.length) params.set("status", statuses.join(","));
    if (category) params.set("category", category);

    fetch(`/api/v1/reports?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad response"))))
      .then((data: { reports: ReportSummary[] }) => {
        if (id === requestId.current) setReports(data.reports);
      })
      .catch(() => {
        if (id === requestId.current) setError(true);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [statuses, category]);

  function toggle(status: Status) {
    setStatuses((prev) => {
      const next = prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status];
      // Never end up with nothing selected.
      return next.length === 0 ? [...PUBLIC_STATUSES] : next;
    });
  }

  return (
    <section aria-label="Reports map and list">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PUBLIC_STATUSES.map((s) => {
          const on = statuses.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                on ? "border-slate-300 bg-white text-slate-900 shadow-sm" : "border-transparent bg-slate-200/60 text-slate-500"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: on ? STATUS_COLOR[s] : "#94a3b8" }} />
              {STATUS_LABEL[s]}
            </button>
          );
        })}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="field !w-auto !py-1.5 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-slate-500" aria-live="polite">
          {loading ? "Updating…" : `${reports.length} report${reports.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not refresh the map. Showing the last results.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ReportsMap
          reports={reports}
          selectedId={selectedId}
          onSelect={setSelectedId}
          className="h-[55vh] min-h-[360px] overflow-hidden rounded-xl border border-slate-200 lg:h-[calc(100vh-15rem)] lg:min-h-[520px]"
        />

        <ul className="space-y-2 lg:max-h-[calc(100vh-15rem)] lg:min-h-[520px] lg:overflow-y-auto lg:pr-1">
          {reports.length === 0 && !loading && (
            <li className="card p-6 text-center text-sm text-slate-500">No reports match these filters yet.</li>
          )}
          {reports.map((r) => (
            <li
              key={r.id}
              className={`card flex gap-3 p-3 transition ${selectedId === r.id ? "ring-2 ring-teal-600" : "hover:border-slate-300"}`}
            >
              {r.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.thumb} alt="" loading="lazy" className="h-16 w-16 flex-none rounded-lg object-cover" />
              ) : (
                <div className="grid h-16 w-16 flex-none place-items-center rounded-lg bg-slate-100 text-slate-400" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/reports/${r.id}`} className="line-clamp-2 font-semibold leading-snug hover:text-teal-700">
                    {r.title}
                  </Link>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {[r.categoryName, r.problemType, r.barangay].filter(Boolean).join(" · ")} · {formatDate(r.createdAt)}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className="mt-1 text-xs font-semibold text-teal-700 hover:underline"
                >
                  Show on map
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
