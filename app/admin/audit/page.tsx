import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/components/ui/Pagination";
import { formatDateTime } from "@/lib/format";
import { requirePageRole } from "@/lib/guards";
import { listAuditLogs } from "@/lib/reports";
import { STATUS_LABEL } from "@/lib/status";
import { listAdminActions } from "@/lib/users";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePageRole("/admin/audit", "admin");

  const page = Math.max(1, Math.floor(Number((await searchParams).page)) || 1);
  // Fetch one extra row to know whether there is a next page.
  const rows = await listAuditLogs(PAGE_SIZE + 1, (page - 1) * PAGE_SIZE);
  const hasNext = rows.length > PAGE_SIZE;
  const entries = rows.slice(0, PAGE_SIZE);
  const accountActions = page === 1 ? await listAdminActions(25) : [];

  return (
    <>
      <PageHeader title="Audit log" description="Every change to every report, and every account change, newest first. MunFix offers no way to edit or delete entries." />

      {accountActions.length > 0 && (
        <section className="mb-8" aria-labelledby="account-changes">
          <h2 id="account-changes" className="mb-3 text-lg font-semibold">
            Recent account changes
          </h2>
          <ul className="card divide-y divide-slate-100 text-sm">
            {accountActions.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
                <time dateTime={a.createdAt} className="w-40 flex-none text-slate-600">
                  {formatDateTime(a.createdAt)}
                </time>
                <div className="min-w-0">
                  <span className="font-semibold capitalize text-slate-900">{a.action.replace(/_/g, " ")}</span>
                  <span className="text-slate-700">
                    {" "}
                    · {a.targetName ?? "—"}
                    {a.targetEmail ? ` (${a.targetEmail})` : ""}
                  </span>
                  <p className="text-slate-600">
                    by {a.actorName ?? "—"}
                    {a.detail ? ` · ${Object.entries(a.detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ")}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="report-changes">
        <h2 id="report-changes" className="mb-3 text-lg font-semibold">
          Report changes
        </h2>
        {entries.length === 0 ? (
          <EmptyState icon="history" title={page === 1 ? "No activity yet" : "No older entries"} description={page === 1 ? "Changes to reports appear here as soon as they happen." : undefined} />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Report changes, page {page}</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">When</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Report</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Change</th>
                  <th scope="col" className="px-4 py-3 font-semibold">By</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <tr key={e.id} className="align-top hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
                    </td>
                    <td className="max-w-[16rem] px-4 py-3">
                      <Link href={`/reports/${e.reportId}`} className="font-medium text-slate-900 hover:text-ink-700 hover:underline">
                        {e.reportTitle}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {e.kind !== "status" ? (
                        <span className="font-semibold">{e.kind === "feedback" ? "Feedback" : "Follow-up request"}</span>
                      ) : (
                        <>
                          {e.fromStatus ? `${STATUS_LABEL[e.fromStatus]} → ` : ""}
                          <span className="font-semibold">{STATUS_LABEL[e.toStatus]}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{e.actorName ?? "—"}</td>
                    <td className="max-w-[20rem] px-4 py-3 text-slate-600">{e.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          prev={page > 1 ? { href: page === 2 ? "/admin/audit" : `/admin/audit?page=${page - 1}` } : null}
          next={hasNext ? { href: `/admin/audit?page=${page + 1}` } : null}
        />
      </section>
    </>
  );
}
