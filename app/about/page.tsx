import type { Metadata } from "next";
import Link from "next/link";
import Icon, { CategoryIcon, type IconName } from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { MUNICIPALITY } from "@/lib/config";
import { RESOLVE_POINTS } from "@/lib/reports";
import { CATEGORIES } from "@/lib/setup";
import { STATUS_COLOR, STATUS_HELP, STATUS_LABEL, type Status } from "@/lib/status";

export const metadata: Metadata = {
  title: "How it works",
  description: `How reporting works on MunFix ${MUNICIPALITY.name}: what to report, how reports are reviewed, and what is public.`,
};

const STEPS: [IconName, string, string][] = [
  ["camera", "Report it", "Sign in, pin the spot on the map, choose a category and add at least one photo."],
  ["shield", "It is public at once", "Your report appears on the public map as soon as you submit it, without your name. Moderators check new reports and hide or reject anything inappropriate."],
  ["refresh", "Crews fix it", "Field staff mark the work as started and resolved. Each step appears on the report's public timeline."],
  ["mail", "You are kept informed", "Follow your reports under My reports, and get an email at each step if email updates are on."],
];

const LIFECYCLE: Status[] = ["verified", "under_review", "in_progress", "resolved"];

export default function AboutPage() {
  return (
    <div className="container-page">
      <PageHeader
        eyebrow={`MunFix ${MUNICIPALITY.name}`}
        title="How it works"
        description={`MunFix lets residents of ${MUNICIPALITY.name}, ${MUNICIPALITY.province} report problems with public infrastructure and follow them until they are fixed.`}
        actions={
          <Link href="/report/new" className="btn btn-accent">
            <Icon name="plus" className="h-4 w-4" />
            Report an issue
          </Link>
        }
      />

      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([icon, title, text], i) => (
          <li key={title} className="card p-5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white">
              <Icon name={icon} />
            </span>
            <h2 className="mt-4 font-semibold text-fg">
              {i + 1}. {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card p-5 sm:p-6" aria-labelledby="lifecycle-title">
          <h2 id="lifecycle-title" className="text-lg font-semibold">
            What each status means
          </h2>
          <dl className="mt-4 space-y-4">
            {[...LIFECYCLE, "hidden" as Status, "rejected" as Status, "duplicate" as Status].map((s) => (
              <div key={s}>
                <dt className="flex items-center gap-3 font-semibold text-fg">
                  <span className="h-3 w-3 flex-none rounded-full" style={{ backgroundColor: STATUS_COLOR[s] }} aria-hidden />
                  {STATUS_LABEL[s]}
                </dt>
                <dd className="pl-6 text-sm text-fg-muted">{STATUS_HELP[s]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="what-title">
            <h2 id="what-title" className="text-lg font-semibold">
              What you can report
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {CATEGORIES.map(([slug, name]) => (
                <li key={slug} className="flex items-center gap-2 text-sm text-fg-muted">
                  <CategoryIcon slug={slug} className="h-4.5 w-4.5 text-accent" />
                  {name}
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
              <strong>Not for emergencies.</strong> For fires, accidents, crime or anything urgent, call your local emergency hotline.
            </p>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="privacy-title">
            <h2 id="privacy-title" className="text-lg font-semibold">
              What is public
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
              <li>Every report, as soon as it is submitted: title, description, photos, location and timeline.</li>
              <li>Your name and email are never shown publicly. Moderators and administrators can see who submitted a report.</li>
              <li>A report a moderator hides or rejects comes off the public map; you and city staff can still see it and the reason.</li>
              <li>You earn {RESOLVE_POINTS} points each time one of your reports is resolved.</li>
            </ul>
            <p className="mt-4 text-sm">
              Read the full <Link href="/privacy" className="link">privacy policy</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
