"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { AdminReportRow } from "@/lib/reports";
import { formatDate } from "@/lib/format";
import type { QueueTab } from "@/lib/permissions";
import StatusBadge from "./StatusBadge";
import TransitionControls from "./TransitionControls";

export default function AdminQueue({ initial, tabs }: { initial: AdminReportRow[]; tabs: QueueTab[] }) {
  const TABS = tabs;
  const [tab, setTab] = useState(tabs[0].key);
  const [rows, setRows] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (key: string) => {
    const tabDef = TABS.find((t) => t.key === key) ?? TABS[0];
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/v1/admin/reports?status=${tabDef.statuses.join(",")}`);
      if (!res.ok) throw new Error("bad response");
      const data = (await res.json()) as { reports: AdminReportRow[] };
      setRows(data.reports);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [TABS]);

  function switchTab(key: string) {
    setTab(key);
    void load(key);
  }

  return (
    <div>
      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => switchTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === t.key ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
        {loading && <span className="self-center text-sm text-slate-500">Loading…</span>}
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not load reports.
        </p>
      )}

      {rows.length === 0 && !loading ? (
        <p className="card p-8 text-center text-slate-500">Nothing here right now.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`/reports/${r.id}`} className="text-base font-semibold hover:text-teal-700">
                  {r.title}
                </Link>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {[r.categoryName, r.problemType, r.barangay].filter(Boolean).join(" · ")} · by {r.reporterName} · {formatDate(r.createdAt)} ·{" "}
                <span className="font-mono">{r.id}</span>
              </p>
              <p className="mt-2 line-clamp-3 text-sm text-slate-700">{r.description}</p>
              {r.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.thumb} alt="" className="mt-3 h-20 rounded-lg object-cover" />
              )}
              <div className="mt-3 border-t border-slate-100 pt-3">
                <TransitionControls id={r.id} allowed={r.allowed} onDone={() => load(tab)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
