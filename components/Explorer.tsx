"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Category, ReportSummary } from "@/lib/reports";
import { PUBLIC_STATUSES, STATUS_COLOR, STATUS_LABEL, type Status } from "@/lib/status";
import { formatDate } from "@/lib/format";
import ReportsMap from "./ReportsMap";
import StatusBadge from "./StatusBadge";

/** The map opens on reports that still need work; citizens can switch on Resolved. */
const DEFAULT_STATUSES: Status[] = ["verified", "in_progress"];

interface Stats {
  verified: number;
  inProgress: number;
  resolved: number;
  avgResolutionDays: number | null;
}

export default function Explorer({
  initialReports,
  categories,
  stats,
}: {
  initialReports: ReportSummary[];
  categories: Category[];
  stats: Stats;
}) {
  const [reports, setReports] = useState(initialReports.filter((r) => DEFAULT_STATUSES.includes(r.status)));
  const [statuses, setStatuses] = useState<Status[]>([...DEFAULT_STATUSES]);
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [panel, setPanel] = useState<"filters" | "list" | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
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

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? reports
        .filter((r) =>
          [r.title, r.categoryName, r.problemType, r.barangay, r.address].some((v) => v?.toLowerCase().includes(needle)),
        )
        .slice(0, 8)
    : [];

  function pick(id: string) {
    setSelectedId(id);
    setQuery("");
    setSearchOpen(false);
  }

  const filtered = statuses.join() !== DEFAULT_STATUSES.join() || category !== "";
  const btn = "inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 panel hover:bg-slate-50";

  return (
    <section aria-label="Reports map" className="relative h-[calc(100svh-4rem)] min-h-[480px]">
      <ReportsMap
        reports={reports}
        categories={categories}
        selectedId={selectedId}
        onSelect={setSelectedId}
        className="h-full w-full"
      />

      <div className="absolute left-3 top-3 flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 sm:w-96">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            placeholder="Search problems, places, barangays…"
            aria-label="Search reports"
            className="w-full rounded-xl bg-white px-4 py-2.5 text-sm panel placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-ink-600"
          />
          {searchOpen && needle && (
            <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-xl bg-white py-1 text-sm shadow-lg ring-1 ring-black/5">
              {matches.length === 0 && <li className="px-4 py-2 text-slate-500">No matching reports on the map.</li>}
              {matches.map((r) => (
                <li key={r.id}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r.id)} className="block w-full px-4 py-2 text-left hover:bg-slate-50">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="block truncate text-xs text-slate-500">{[r.categoryName, r.problemType, r.barangay].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" className={btn} aria-expanded={panel === "filters"} onClick={() => setPanel(panel === "filters" ? null : "filters")}>
            Filters{filtered && <span className="h-2 w-2 rounded-full bg-orange-500" aria-label="active" />}
          </button>
          <button type="button" className={btn} aria-expanded={panel === "list"} onClick={() => setPanel(panel === "list" ? null : "list")}>
            List
          </button>
          {loading && <span className="self-center rounded-full bg-white/90 px-2 py-1 text-xs text-slate-500 shadow">Updating…</span>}
        </div>

        {panel === "filters" && (
          <div className="rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <div className="flex flex-wrap gap-2">
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
            </div>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="field mt-1 text-sm font-normal normal-case tracking-normal text-slate-900">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {panel === "list" && (
          <div className="flex max-h-[calc(100svh-11rem)] flex-col rounded-xl bg-white shadow-lg ring-1 ring-black/5">
            <dl className="grid grid-cols-4 gap-2 border-b border-slate-100 p-3 text-center">
              {[
                ["Verified", stats.verified, "#d97706"],
                ["In progress", stats.inProgress, "#2563eb"],
                ["Resolved", stats.resolved, "#16a34a"],
                ["Avg. fix", stats.avgResolutionDays === null ? "—" : `${stats.avgResolutionDays}d`, "#1d3557"],
              ].map(([label, value, color]) => (
                <div key={label as string}>
                  <dd className="text-lg font-bold" style={{ color: color as string }}>{value}</dd>
                  <dt className="text-[11px] text-slate-500">{label}</dt>
                </div>
              ))}
            </dl>
            {error && <p role="alert" className="m-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Could not refresh the map. Showing the last results.</p>}
            <ul className="space-y-2 overflow-y-auto p-3">
              {reports.length === 0 && !loading && <li className="p-6 text-center text-sm text-slate-500">No reports match these filters yet.</li>}
              {reports.map((r) => (
                <li key={r.id} className={`flex gap-3 rounded-lg border p-2 ${selectedId === r.id ? "border-ink-600 ring-1 ring-ink-600" : "border-slate-200"}`}>
                  {r.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumb} alt="" loading="lazy" className="h-14 w-14 flex-none rounded-md object-cover" />
                  ) : (
                    <div className="grid h-14 w-14 flex-none place-items-center rounded-md bg-slate-100 text-slate-400" aria-hidden>
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
                        <circle cx="12" cy="10" r="2.5" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/reports/${r.id}`} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-ink-700">
                        {r.title}
                      </Link>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {[r.categoryName, r.problemType, r.barangay].filter(Boolean).join(" · ")} · {formatDate(r.createdAt)}
                    </p>
                    <button type="button" onClick={() => setSelectedId(r.id)} className="text-xs font-semibold text-ink-700 hover:underline">
                      Show on map
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
