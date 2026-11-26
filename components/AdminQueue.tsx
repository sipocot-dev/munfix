"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminReportRow } from "@/lib/reports";
import { formatDate } from "@/lib/format";
import type { QueueTab } from "@/lib/permissions";
import type { Status } from "@/lib/status";
import StatusBadge from "./StatusBadge";
import TransitionControls from "./TransitionControls";
import EmptyState from "./ui/EmptyState";
import Icon, { CategoryIcon } from "./ui/Icon";
import { Skeleton } from "./ui/Skeleton";

/** Work queue: one stage at a time, newest first. The stage is kept in the URL (?tab=) so a reload stays put. */
export default function AdminQueue({ initial, tabs, initialTab }: { initial: AdminReportRow[]; tabs: QueueTab[]; initialTab: string }) {
  const [tab, setTab] = useState(initialTab);
  const [rows, setRows] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const requestId = useRef(0);
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];

  const load = useCallback(
    async (key: string) => {
      const def = tabs.find((t) => t.key === key) ?? tabs[0];
      const id = ++requestId.current;
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/v1/admin/reports?status=${def.statuses.join(",")}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { reports: AdminReportRow[] };
        if (id === requestId.current) setRows(data.reports);
      } catch {
        if (id === requestId.current) setError(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [tabs],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === tabs[0].key) url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", url);
  }, [tab, tabs]);

  function switchTab(key: string) {
    if (key === tab) return;
    setTab(key);
    setRows([]);
    void load(key);
  }

  /** The server accepted the change: drop the row here at once if it left this stage, then refresh quietly. */
  function moved(id: string, to: Status) {
    if (!current.statuses.includes(to)) setRows((r) => r.filter((x) => x.id !== id));
    void load(tab);
  }

  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      needle
        ? rows.filter((r) => [r.title, r.barangay, r.address, r.categoryName, r.reporterName, r.id].some((v) => v?.toLowerCase().includes(needle)))
        : rows,
    [rows, needle],
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Stage" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => switchTab(t.key)} className="chip">
              {t.label}
              {tab === t.key && !loading && <span className="rounded-full bg-surface px-1.5 text-xs tabular-nums">{rows.length}</span>}
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter this list" aria-label="Filter the reports in this stage" className="field !pl-9" />
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          <span className="flex items-center gap-2">
            <Icon name="alert" className="h-4 w-4" />
            Could not load this stage.
          </span>
          <button type="button" onClick={() => load(tab)} className="btn btn-secondary btn-sm">
            <Icon name="refresh" className="h-4 w-4" />
            Try again
          </button>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {loading ? "Loading reports…" : `${shown.length} reports in ${current.label}`}
      </p>

      {loading && rows.length === 0 ? (
        <ul className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="card flex gap-4 p-4">
              <Skeleton className="hidden h-24 w-24 flex-none sm:block" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="mt-3 h-8 w-48" />
              </div>
            </li>
          ))}
        </ul>
      ) : shown.length === 0 && !error ? (
        <EmptyState
          icon={needle ? "search" : "check"}
          title={needle ? "No reports match this filter" : `Nothing in “${current.label}”`}
          description={needle ? "Try another word, or clear the filter." : "When reports reach this stage they will show up here."}
        />
      ) : (
        <ul className={`space-y-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {shown.map((r) => (
            <li key={r.id} className="card p-4 sm:p-5">
              <div className="flex gap-4">
                {r.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.thumb} alt="" loading="lazy" className="hidden h-24 w-24 flex-none rounded-md bg-surface-3 object-cover sm:block" />
                ) : (
                  <div className="hidden h-24 w-24 flex-none place-items-center rounded-md bg-surface-3 text-fg-muted sm:grid" aria-hidden>
                    <CategoryIcon slug={r.categorySlug} className="h-7 w-7" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/reports/${r.id}`} className="font-semibold text-fg hover:text-accent hover:underline">
                      {r.title}
                    </Link>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-fg-muted">
                    <span className="inline-flex items-center gap-1">
                      <CategoryIcon slug={r.categorySlug} className="h-3.5 w-3.5" />
                      {[r.categoryName, r.problemType].filter(Boolean).join(" · ")}
                    </span>
                    {r.barangay && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="pin" className="h-3.5 w-3.5" />
                        {r.barangay}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Icon name="calendar" className="h-3.5 w-3.5" />
                      {formatDate(r.createdAt)}
                    </span>
                    {/* Field staff get "Hidden" from the server: reporters stay anonymous to them. */}
                    {r.reporterName !== "Hidden" && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="user" className="h-3.5 w-3.5" />
                        {r.reporterName}
                      </span>
                    )}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm text-fg-muted">{r.description}</p>
                </div>
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <TransitionControls id={r.id} allowed={r.allowed} onDone={(to) => moved(r.id, to)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
