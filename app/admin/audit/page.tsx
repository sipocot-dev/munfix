import type { Metadata } from "next";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { requirePageRole } from "@/lib/guards";
import { listAdminActions } from "@/lib/users";
import { formatDateTime } from "@/lib/format";
import { listAuditLogs } from "@/lib/reports";
import { STATUS_LABEL } from "@/lib/status";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requirePageRole("/admin/audit", "admin");

  const page = Math.max(1, Math.floor(Number((await searchParams).page)) || 1);
  // Fetch one extra row to know whether there is a next page.
  const rows = await listAuditLogs(PAGE_SIZE + 1, (page - 1) * PAGE_SIZE);
  const hasNext = rows.length > PAGE_SIZE;
  const entries = rows.slice(0, PAGE_SIZE);
  const accountActions = page === 1 ? await listAdminActions(25) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Audit log</h1>
      <p className="mt-2 mb-4 text-slate-600">Every status change on every report, and every account change, newest first.</p>
      <AdminNav role={session.role} current="/admin/audit" />
      {accountActions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">Account changes</h2>
          <div className="card divide-y divide-slate-100 text-sm">
            {accountActions.map((a) => (
              <div key={a.id} className="flex flex-wrap gap-x-3 px-4 py-2">
                <span className="text-slate-500">{formatDateTime(a.createdAt)}</span>
                <span className="font-semibold">{a.action.replace(/_/g, " ")}</span>
                <span className="text-slate-600">
                  {a.targetName ?? "—"}
                  {a.targetEmail ? ` (${a.targetEmail})` : ""} · by {a.actorName ?? "—"}
                  {a.detail ? ` · ${Object.entries(a.detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(",") : String(v)}`).join(", ")}` : ""}
                </span>
              </div>
            ))}
          </div>
          <h2 className="mb-2 mt-8 text-lg font-semibold">Report changes</h2>
        </section>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Report</th>
              <th className="px-4 py-3">Change</th>
              <th className="px-4 py-3">By</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No activity yet.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(e.createdAt)}</td>
                <td className="px-4 py-3">
                  <Link href={`/reports/${e.reportId}`} className="font-medium hover:text-ink-700">
                    {e.reportTitle}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {e.fromStatus ? `${STATUS_LABEL[e.fromStatus]} → ` : ""}
                  <span className="font-semibold">{STATUS_LABEL[e.toStatus]}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{e.actorName ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{e.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between text-sm font-semibold text-ink-700">
        {page > 1 ? <Link href={`/admin/audit?page=${page - 1}`}>← Newer</Link> : <span />}
        {hasNext && <Link href={`/admin/audit?page=${page + 1}`}>Older →</Link>}
      </div>
    </div>
  );
}
