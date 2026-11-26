import type { Metadata } from "next";
import Link from "next/link";
import MyReportsList from "@/components/MyReportsList";
import NotificationToggle from "@/components/NotificationToggle";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { query } from "@/lib/db";
import { requirePagePermission } from "@/lib/guards";
import { mailEnabled } from "@/lib/mail";
import { getPoints, listUserReports } from "@/lib/reports";
import type { Status } from "@/lib/status";

export const metadata: Metadata = { title: "My reports" };

export default async function MyReportsPage() {
  const session = await requirePagePermission("/me");
  const [reports, points, prefs] = await Promise.all([
    listUserReports(session.userId),
    getPoints(session.userId),
    mailEnabled()
      ? query<{ email_notifications: boolean }>("SELECT email_notifications FROM users WHERE id = $1", [session.userId]).then((r) => r[0])
      : Promise.resolve(undefined),
  ]);
  const count = (...s: Status[]) => reports.filter((r) => s.includes(r.status)).length;

  return (
    <div className="container-page">
      <PageHeader
        eyebrow={`Signed in as ${session.name}`}
        title="My reports"
        description="Everything you have reported, and where each one stands."
        actions={
          <Link href="/report/new" className="btn btn-accent">
            <Icon name="plus" className="h-4 w-4" />
            Report an issue
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Public, not started" value={count("verified", "under_review")} icon="map" accent="#92400e" />
        <StatCard label="In progress" value={count("in_progress")} icon="refresh" accent="#1d4ed8" />
        <StatCard label="Resolved" value={count("resolved")} icon="check" accent="#15803d" />
        <StatCard label="Points" value={points} hint="10 for each resolved report" icon="sparkle" accent="#9a3412" />
      </div>

      {prefs && (
        <div className="mt-6">
          <NotificationToggle initial={prefs.email_notifications} />
        </div>
      )}

      <section className="mt-8" aria-labelledby="list-title">
        <h2 id="list-title" className="mb-3 text-lg font-semibold">
          Your reports
        </h2>
        {reports.length === 0 ? (
          <EmptyState
            icon="pin"
            title="You have not reported anything yet"
            description="Seen a pothole, a broken streetlight or a clogged drain? Report it and follow it until it is fixed."
            action={
              <Link href="/report/new" className="btn btn-accent">
                Report your first issue
              </Link>
            }
          />
        ) : (
          <MyReportsList reports={reports} />
        )}
      </section>
    </div>
  );
}
