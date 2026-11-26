import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommunityActions from "@/components/CommunityActions";
import EditReportForm from "@/components/EditReportForm";
import LocationCard from "@/components/LocationCard";
import PhotoGallery from "@/components/PhotoGallery";
import ProgressSteps from "@/components/ProgressSteps";
import ShareReport from "@/components/ShareReport";
import StaticMap from "@/components/StaticMap";
import StatusBadge from "@/components/StatusBadge";
import TransitionControls from "@/components/TransitionControls";
import WithdrawButton from "@/components/WithdrawButton";
import Alert from "@/components/ui/Alert";
import Icon, { CategoryIcon } from "@/components/ui/Icon";
import { formatDate, formatDateTime } from "@/lib/format";
import { canViewUnpublished, hasWorkspace } from "@/lib/permissions";
import { getReportDetail } from "@/lib/reports";
import { getSession } from "@/lib/session";
import { STATUS_COLOR, STATUS_HELP, STATUS_LABEL, isPublicStatus } from "@/lib/status";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ submitted?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const report = await getReportDetail((await params).id, await getSession());
  if (!report) return { title: "Report not found" };
  // Only public reports get a description for link previews; unpublished ones stay private.
  return isPublicStatus(report.status)
    ? { title: report.title, description: `${STATUS_LABEL[report.status]} · ${report.categoryName}${report.barangay ? ` · ${report.barangay}` : ""}`, openGraph: { title: report.title } }
    : { title: report.title, robots: { index: false } };
}

export default async function ReportPage({ params, searchParams }: Props) {
  const { id } = await params;
  const justSubmitted = (await searchParams)?.submitted === "1";
  const session = await getSession();
  const report = await getReportDetail(id, session);
  if (!report) notFound();

  const privileged = canViewUnpublished(session?.permissions);
  const hidden = !isPublicStatus(report.status);
  const closed = report.status === "rejected" || report.status === "duplicate" || report.status === "withdrawn";
  const staffCard = hasWorkspace(session?.permissions) && report.allowedTransitions;
  const where = [report.barangay, report.address].filter(Boolean).join(" · ");

  return (
    <div className="container-page">
      <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-strong">
        <Icon name="arrowLeft" className="h-4 w-4" />
        Back to the map
      </Link>

      <header className="mb-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
          <CategoryIcon slug={report.categorySlug} className="h-4.5 w-4.5" />
          {[report.categoryName, report.problemType].filter(Boolean).join(" · ")}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-fg text-balance sm:text-3xl">{report.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
          <StatusBadge status={report.status} size="md" />
          <span className="inline-flex items-center gap-1.5">
            <Icon name="calendar" className="h-4 w-4 text-fg-muted" />
            Reported {formatDate(report.createdAt)}
          </span>
          {report.resolvedAt && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="check" className="h-4 w-4 text-success" />
              Resolved {formatDate(report.resolvedAt)}
            </span>
          )}
          {where && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="pin" className="h-4 w-4 text-fg-muted" />
              {where}
            </span>
          )}
        </div>
      </header>

      <div className="space-y-3">
        {justSubmitted && report.isOwner && (
          <Alert tone="success" title="Thank you, your report is published">
            It is on the public map now, without your name. City staff will pick it up from there; follow its progress here and under My reports.
          </Alert>
        )}
        {hidden && !closed && (
          <Alert tone="info" live={false} title={report.status === "hidden" ? "Hidden from the public" : "Not public yet"}>
            {report.status === "hidden"
              ? "A moderator took this report off the public map; the reason is in the timeline. Only the reporter and city staff can see it."
              : `Only ${privileged && !report.isOwner ? "you, other moderators and the reporter" : "you and city staff"} can see this report until a moderator publishes it.`}
          </Alert>
        )}
        {report.status === "duplicate" && (
          <Alert tone="neutral" live={false} title="Merged into another report">
            {report.duplicateOf ? (
              <>
                Follow the{" "}
                <Link href={`/reports/${report.duplicateOf}`} className="font-semibold underline">
                  original report
                </Link>{" "}
                for updates.
              </>
            ) : (
              "Another report already covers this problem."
            )}
          </Alert>
        )}
        {report.status === "rejected" && (
          <Alert tone="neutral" live={false} title="Not accepted">
            The reason is in the timeline below.
          </Alert>
        )}
        {report.status === "withdrawn" && <Alert tone="neutral" live={false} title="Withdrawn by the reporter" />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {!closed && (
            <section className="card p-5 sm:p-6" aria-labelledby="progress-title">
              <h2 id="progress-title" className="sr-only">
                Progress
              </h2>
              <ProgressSteps status={report.status} />
              <p className="mt-5 rounded-lg bg-surface-2 px-4 py-3 text-sm text-fg-muted">
                <span className="font-semibold">{STATUS_LABEL[report.status]}:</span> {STATUS_HELP[report.status]}
              </p>
            </section>
          )}

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-semibold">What was reported</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-fg-muted">{report.description}</p>
            {report.media.length > 0 && <PhotoGallery photos={report.media} />}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Timeline</h2>
            {report.events.length === 0 ? (
              <p className="mt-2 text-sm text-fg-muted">No updates yet.</p>
            ) : (
              <ol className="mt-5 space-y-6">
                {report.events.map((e, i) => (
                  <li key={e.id} className="relative flex gap-4">
                    {i < report.events.length - 1 && <span className="absolute left-[11px] top-7 h-[calc(100%+0.5rem)] w-0.5 bg-surface-3" aria-hidden />}
                    <span className="relative mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full ring-4 ring-surface" style={{ backgroundColor: STATUS_COLOR[e.toStatus] }} aria-hidden>
                      <span className="h-2 w-2 rounded-full bg-surface" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-fg">{STATUS_LABEL[e.toStatus]}</p>
                      <p className="text-sm text-fg-muted">
                        <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
                        {e.actorName && <> · {e.actorName}</>}
                      </p>
                      {e.note && <p className="mt-1.5 whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg-muted">{e.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <CommunityActions
            id={report.id}
            signedIn={Boolean(session)}
            canReopen={report.status === "resolved" && (report.isOwner || hasWorkspace(session?.permissions))}
            feedback={report.feedback}
            followups={report.followups}
          />
        </div>

        <aside className="min-w-0 space-y-6">
          {staffCard && (
            <section className="card border-line-strong p-5" aria-labelledby="staff-title">
              <h2 id="staff-title" className="flex items-center gap-2 text-lg font-semibold">
                <Icon name="shield" className="h-5 w-5 text-accent" />
                {session?.permissions.includes("reports.review") ? "Moderation" : "Field work"}
              </h2>
              {report.reporter && (
                <p className="mt-2 text-sm text-fg-muted">
                  Reported by <span className="font-semibold text-fg">{report.reporter.name}</span>
                  <br />
                  <a href={`mailto:${report.reporter.email}`} className="link break-all font-normal">
                    {report.reporter.email}
                  </a>
                </p>
              )}
              <div className="mt-4">
                <TransitionControls id={report.id} allowed={report.allowedTransitions!} />
              </div>
            </section>
          )}

          {(report.canEdit || report.canWithdraw) && (
            <section className="card space-y-4 p-5" aria-labelledby="owner-title">
              <h2 id="owner-title" className="text-lg font-semibold">
                Your report
              </h2>
              {report.canEdit && (
                <EditReportForm
                  id={report.id}
                  initial={{ title: report.title, description: report.description, address: report.address ?? "", barangay: report.barangay ?? "" }}
                />
              )}
              {report.canWithdraw && (
                <div className="border-t border-line pt-4">
                  <p className="mb-3 text-sm text-fg-muted">You can withdraw this report while it is still being reviewed.</p>
                  <WithdrawButton id={report.id} />
                </div>
              )}
            </section>
          )}

          <div className="space-y-3">
            <StaticMap lng={report.lng} lat={report.lat} status={report.status} />
            <LocationCard lat={report.lat} lng={report.lng} address={report.address} />
          </div>
          {!hidden && <ShareReport title={report.title} />}
        </aside>
      </div>
    </div>
  );
}
