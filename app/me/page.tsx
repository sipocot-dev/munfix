import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import NotificationToggle from "@/components/NotificationToggle";
import StatusBadge from "@/components/StatusBadge";
import { query } from "@/lib/db";
import { mailEnabled } from "@/lib/mail";
import { formatDate } from "@/lib/format";
import { listUserReports } from "@/lib/reports";
import { getSession } from "@/lib/session";
import { isPublicStatus } from "@/lib/status";

export const metadata: Metadata = { title: "My reports" };

export default async function MyReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/me");
  const reports = await listUserReports(session.userId);
  const [prefs] = mailEnabled()
    ? await query<{ email_notifications: boolean }>("SELECT email_notifications FROM users WHERE id = $1", [session.userId])
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">My reports</h1>
        <Link href="/report/new" className="btn btn-primary">
          New report
        </Link>
      </div>

      {prefs && <NotificationToggle initial={prefs.email_notifications} />}

      {reports.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-600">You have not reported anything yet.</p>
          <Link href="/report/new" className="mt-4 inline-block font-semibold text-teal-700 hover:underline">
            Report your first issue →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`/reports/${r.id}`} className="font-semibold hover:text-teal-700">
                  {r.title}
                </Link>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {[r.categoryName, r.barangay].filter(Boolean).join(" · ")} · submitted {formatDate(r.createdAt)}
                {!isPublicStatus(r.status) && r.status !== "rejected" && r.status !== "withdrawn" && r.status !== "duplicate" && (
                  <> · not public yet</>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
