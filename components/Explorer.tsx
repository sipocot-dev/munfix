"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, ReportSummary, Stats } from "@/lib/reports";
import { MUNICIPALITY } from "@/lib/config";
import { DEFAULT_STATUSES, filtersToQuery, matchesQuery, type ExplorerFilters } from "@/lib/explorer";
import { formatDate } from "@/lib/format";
import { PUBLIC_STATUSES, STATUS_COLOR, STATUS_LABEL, type Status } from "@/lib/status";
import ReportsMap from "./ReportsMap";
import StatusBadge from "./StatusBadge";
import Icon, { CategoryIcon } from "./ui/Icon";
import { Skeleton } from "./ui/Skeleton";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Explorer({
  initialReports,
  categories,
  stats,
  initialFilters,
}: {
  initialReports: ReportSummary[];
  categories: Category[];
  /** null when the numbers could not be loaded. */
  stats: Stats | null;
  initialFilters: ExplorerFilters;
}) {
  const [statuses, setStatuses] = useState<Status[]>(initialFilters.statuses);
  const [category, setCategory] = useState(initialFilters.category);
  const [query, setQuery] = useState(initialFilters.q);
  const needle = useDebounced(query.trim(), 200);
  const [reports, setReports] = useState(() =>
    initialReports.filter((r) => initialFilters.statuses.includes(r.status) && (!initialFilters.category || r.categorySlug === initialFilters.category)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [inView, setInView] = useState<Set<string> | null>(null);
  const [onlyInView, setOnlyInView] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const first = useRef(true);
  const requestId = useRef(0);

  // Refetch from the server when status or category change (the server caps a list at 500).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ limit: "500" });
    if (statuses.length < PUBLIC_STATUSES.length) params.set("status", statuses.join(","));
    if (category) params.set("category", category);
    fetch(`/api/v1/reports?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
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

  // Keep the address bar in step with the filters, without adding history entries.
  useEffect(() => {
    const url = `${window.location.pathname}${filtersToQuery({ statuses, category, q: needle })}`;
    window.history.replaceState(window.history.state, "", url);
  }, [statuses, category, needle]);

  const matching = useMemo(() => reports.filter((r) => matchesQuery(r, needle)), [reports, needle]);
  const listed = onlyInView && inView ? matching.filter((r) => inView.has(r.id)) : matching;
  const filtered = statuses.join() !== DEFAULT_STATUSES.join() || category !== "" || needle !== "";

  function toggle(status: Status) {
    setStatuses((prev) => {
      const next = prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status];
      // Never end up with nothing selected; keep the canonical order so URLs are stable.
      return next.length === 0 ? [...PUBLIC_STATUSES] : PUBLIC_STATUSES.filter((s) => next.includes(s));
    });
  }

  function reset() {
    setStatuses([...DEFAULT_STATUSES]);
    setCategory("");
    setQuery("");
  }

  function showOnMap(id: string) {
    setSelectedId(id);
    setMobileView("map");
  }

  const searchBox = (
    <div className="relative">
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-fg-subtle" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search problems, places, barangays"
        aria-label="Search reports"
        className="field !pl-10 !pr-10"
      />
      {query && (
        <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-fg-muted hover:bg-surface-3">
          <Icon name="x" className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <section aria-label="Reports map and list" className="relative grid h-[calc(100svh-4rem)] min-h-[520px] lg:grid-cols-[420px_minmax(0,1fr)]">
      {/* Sidebar: the accessible, keyboard-first view of everything on the map. */}
      <div className={`${mobileView === "list" ? "flex" : "hidden"} min-h-0 flex-col border-r border-line bg-surface lg:flex`}>
        <div className="space-y-4 border-b border-line p-4 sm:p-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-fg">Reported issues in {MUNICIPALITY.name}</h1>
            <p className="mt-1 text-sm text-fg-muted">Problems residents have reported, and how far along each one is.</p>
          </div>
          <StatsRow stats={stats} />
          {searchBox}
          <fieldset>
            <legend className="eyebrow mb-2">Status</legend>
            <div className="flex flex-wrap gap-2">
              {PUBLIC_STATUSES.map((s) => (
                <button key={s} type="button" aria-pressed={statuses.includes(s)} onClick={() => toggle(s)} className="chip">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statuses.includes(s) ? STATUS_COLOR[s] : "#94a3b8" }} aria-hidden />
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="explorer-category" className="eyebrow mb-2 block">
              Category
            </label>
            <select id="explorer-category" value={category} onChange={(e) => setCategory(e.target.value)} className="field">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-sm sm:px-5">
          <p aria-live="polite" className="font-medium text-fg-muted">
            {loading ? "Updating…" : `${listed.length} report${listed.length === 1 ? "" : "s"}`}
            {filtered && !loading && (
              <button type="button" onClick={reset} className="ml-2 font-semibold text-accent underline underline-offset-2">
                Clear filters
              </button>
            )}
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 text-fg-muted">
            <input type="checkbox" checked={onlyInView} onChange={(e) => setOnlyInView(e.target.checked)} className="h-4 w-4 accent-primary" />
            Only in map view
          </label>
        </div>

        {error && (
          <p role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            <Icon name="alert" className="mt-0.5 h-4 w-4 flex-none" />
            Could not refresh the reports. Showing the last results.
          </p>
        )}

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4" aria-busy={loading}>
          {loading && listed.length === 0 &&
            Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-line p-3">
                <Skeleton className="h-16 w-16 flex-none" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </li>
            ))}
          {!loading && listed.length === 0 && (
            <li className="px-4 py-10 text-center">
              <Icon name="search" className="mx-auto h-7 w-7 text-fg-subtle" />
              <p className="mt-2 font-semibold text-fg">{reports.length === 0 && !filtered ? "No public reports yet" : "No reports match"}</p>
              <p className="mt-1 text-sm text-fg-muted">
                {reports.length === 0 && !filtered ? "Reports appear here and on the map as soon as residents submit them." : onlyInView ? "Move the map, or turn off “Only in map view”." : "Try another word or clear the filters."}
              </p>
            </li>
          )}
          {listed.map((r) => (
            <li
              key={r.id}
              onMouseEnter={() => setHoverId(r.id)}
              onMouseLeave={() => setHoverId(null)}
              className={`group flex gap-3 rounded-lg border p-3 transition-colors ${selectedId === r.id ? "border-primary bg-accent-soft/50 ring-1 ring-primary" : "border-line hover:border-line-strong"}`}
            >
              {r.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.thumb} alt="" loading="lazy" decoding="async" className="h-16 w-16 flex-none rounded-md bg-surface-3 object-cover" />
              ) : (
                <div className="grid h-16 w-16 flex-none place-items-center rounded-md bg-surface-3 text-fg-muted" aria-hidden>
                  <CategoryIcon slug={r.categorySlug} className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/reports/${r.id}`} className="line-clamp-2 text-sm font-semibold leading-snug text-fg hover:text-accent hover:underline">
                    {r.title}
                  </Link>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 truncate text-xs text-fg-muted">
                  {[r.categoryName, r.barangay].filter(Boolean).join(" · ")} · {formatDate(r.createdAt)}
                </p>
                <button type="button" onClick={() => showOnMap(r.id)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                  <Icon name="pin" className="h-3.5 w-3.5" />
                  Show on map
                </button>
              </div>
            </li>
          ))}
        </ul>

        <p className="border-t border-line px-4 py-3 text-xs text-fg-muted sm:px-5">
          <Link href="/about" className="hover:underline">How it works</Link> · <Link href="/privacy" className="hover:underline">Privacy</Link> ·{" "}
          <Link href="/terms" className="hover:underline">Terms</Link> · Not for emergencies
        </p>
      </div>

      <div className={`${mobileView === "map" ? "block" : "hidden"} relative min-h-0 lg:block`}>
        <ReportsMap
          reports={matching}
          categories={categories}
          selectedId={selectedId}
          highlightId={hoverId}
          onSelect={setSelectedId}
          onViewChange={setInView}
          className="h-full w-full"
        />
        {/* Phones: search stays on the map; filters live in the list view. */}
        <div className="absolute inset-x-3 top-3 flex gap-2 lg:hidden">
          <div className="panel min-w-0 flex-1">{searchBox}</div>
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className="panel relative grid h-11 w-11 flex-none place-items-center text-fg-muted"
            aria-label={filtered ? "Filters (active)" : "Filters"}
          >
            <Icon name="filter" />
            {filtered && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-signal-600" aria-hidden />}
          </button>
        </div>
      </div>

      {/* Phones: switch between the map and the list. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center lg:hidden">
        <div role="group" aria-label="View" className="pointer-events-auto flex rounded-full bg-slate-900 p-1 text-sm font-semibold text-white shadow-[var(--shadow-raised)]">
          {(["map", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={mobileView === v}
              onClick={() => setMobileView(v)}
              className={`inline-flex h-10 items-center gap-2 rounded-full px-4 ${mobileView === v ? "bg-white text-slate-900" : "text-slate-200"}`}
            >
              <Icon name={v} className="h-4 w-4" />
              {v === "map" ? "Map" : `List (${listed.length})`}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsRow({ stats }: { stats: Stats | null }) {
  const cells: [string, number | string | null][] = [
    ["Published", stats?.verified ?? null],
    ["In progress", stats?.inProgress ?? null],
    ["Resolved", stats?.resolved ?? null],
    ["Avg. days to fix", stats ? stats.avgResolutionDays : null],
  ];
  return (
    <div>
      <dl className="grid grid-cols-4 divide-x divide-line rounded-lg border border-line">
        {cells.map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse px-2 py-2 text-center">
            <dt className="text-[11px] leading-tight text-fg-muted">{label}</dt>
            <dd className="text-lg font-bold tabular-nums text-fg">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {!stats && <p className="mt-1.5 text-xs text-fg-muted">Figures are not available right now.</p>}
    </div>
  );
}
