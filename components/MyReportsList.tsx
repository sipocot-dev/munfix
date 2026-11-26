"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReportSummary } from "@/lib/reports";
import { formatDate } from "@/lib/format";
import { STATUS_HELP, type Status } from "@/lib/status";
import StatusBadge from "./StatusBadge";
import { CategoryIcon } from "./ui/Icon";

export const REPORT_GROUPS: { key: string; label: string; statuses: Status[] }[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "public", label: "Public, not started", statuses: ["verified", "under_review", "submitted"] },
  { key: "active", label: "In progress", statuses: ["in_progress"] },
  { key: "resolved", label: "Resolved", statuses: ["resolved"] },
  { key: "closed", label: "Hidden or closed", statuses: ["hidden", "rejected", "duplicate", "withdrawn"] },
];

/** The signed-in citizen's reports, filterable by stage. Filtering is local: the full list is already loaded. */
export default function MyReportsList({ reports }: { reports: ReportSummary[] }) {
  const [group, setGroup] = useState("all");
  const def = REPORT_GROUPS.find((g) => g.key === group)!;
  const shown = def.statuses.length ? reports.filter((r) => def.statuses.includes(r.status)) : reports;

  return (
    <div>
      <div role="group" aria-label="Filter by stage" className="mb-4 flex flex-wrap gap-2">
        {REPORT_GROUPS.map((g) => {
          const n = g.statuses.length ? reports.filter((r) => g.statuses.includes(r.status)).length : reports.length;
          return (
            <button key={g.key} type="button" aria-pressed={group === g.key} onClick={() => setGroup(g.key)} className="chip">
              {g.label}
              <span className="rounded-full bg-surface-3 px-1.5 text-xs tabular-nums text-fg-muted">{n}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="card px-6 py-10 text-center text-sm text-fg-muted">No reports at this stage.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="card flex gap-4 p-4 transition-colors hover:border-line-strong">
              {r.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.thumb} alt="" loading="lazy" className="h-20 w-20 flex-none rounded-md bg-surface-3 object-cover" />
              ) : (
                <div className="grid h-20 w-20 flex-none place-items-center rounded-md bg-surface-3 text-fg-muted" aria-hidden>
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
                <p className="mt-1 text-sm text-fg-muted">
                  {[r.categoryName, r.barangay].filter(Boolean).join(" · ")} · submitted {formatDate(r.createdAt)}
                </p>
                <p className="mt-1.5 text-sm text-fg-muted">{STATUS_HELP[r.status]}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
