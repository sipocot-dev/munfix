import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProgressSteps from "@/components/ProgressSteps";
import StaticMap from "@/components/StaticMap";
import StatusBadge from "@/components/StatusBadge";
import TransitionControls from "@/components/TransitionControls";
import WithdrawButton from "@/components/WithdrawButton";
import { formatDate, formatDateTime } from "@/lib/format";
import { getReportDetail } from "@/lib/reports";
import { getSession } from "@/lib/session";
import { STATUS_LABEL, isPublicStatus } from "@/lib/status";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const report = await getReportDetail((await params).id, await getSession());
  return { title: report ? report.title : "Report not found" };
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  const report = await getReportDetail(id, session);
  if (!report) notFound();

  const isAdmin = session?.role === "admin";
  const hidden = !isPublicStatus(report.status);
  const closed = report.status === "rejected" || report.status === "duplicate" || report.status === "withdrawn";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="text-sm font-semibold text-teal-700 hover:underline">
        ← Back to map
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{report.title}</h1>
        <StatusBadge status={report.status} />
      </div>
      <p className="mt-2 text-sm text-slate-500">
        {[report.categoryName, report.barangay, report.address].filter(Boolean).join(" · ")} · reported {formatDate(report.createdAt)}
        {report.resolvedAt && <> · resolved {formatDate(report.resolvedAt)}</>}
      </p>

      {hidden && !closed && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This report is only visible to {isAdmin && !report.isOwner ? "you and the reporter" : "you and city staff"} until it has been verified.
        </p>
      )}
      {report.status === "duplicate" && (
        <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
          This report duplicates another one.{" "}
          {report.duplicateOf && (
            <Link href={`/reports/${report.duplicateOf}`} className="font-semibold text-teal-700 hover:underline">
              View the original
            </Link>
          )}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {!closed && (
            <section className="card p-5">
              <ProgressSteps status={report.status} />
            </section>
          )}

          <section className="card p-5">
            <h2 className="text-lg font-semibold">Details</h2>
            <p className="mt-2 whitespace-pre-line text-slate-700">{report.description}</p>
            {report.media.length > 0 && (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {report.media.map((m) => (
                  <li key={m.id}>
                    <a href={m.url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt="Photo of the reported issue" className="aspect-square w-full rounded-lg object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-semibold">Timeline</h2>
            {report.events.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No updates yet.</p>
            ) : (
              <ol className="mt-4 space-y-5 border-l-2 border-slate-200 pl-5">
                {report.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.62rem] top-1.5 h-2.5 w-2.5 rounded-full bg-teal-600 ring-4 ring-white" aria-hidden />
                    <p className="font-semibold">{STATUS_LABEL[e.toStatus]}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(e.createdAt)}
                      {e.actorName && <> · {e.actorName}</>}
                    </p>
                    {e.note && <p className="mt-1 text-sm text-slate-700">{e.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <StaticMap lng={report.lng} lat={report.lat} status={report.status} />

          {isAdmin && report.allowedTransitions && (
            <section className="card space-y-3 p-5">
              <h2 className="text-lg font-semibold">Moderation</h2>
              {report.reporter && (
                <p className="text-sm text-slate-600">
                  Reported by <span className="font-medium">{report.reporter.name}</span> ({report.reporter.email})
                </p>
              )}
              <TransitionControls id={report.id} allowed={report.allowedTransitions} />
            </section>
          )}

          {report.canWithdraw && (
            <section className="card space-y-2 p-5">
              <h2 className="text-lg font-semibold">Your report</h2>
              <p className="text-sm text-slate-600">You can withdraw this report while it is still being reviewed.</p>
              <WithdrawButton id={report.id} />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
