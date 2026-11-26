import type { Status } from "@/lib/status";

const STEPS: { status: Status; label: string }[] = [
  { status: "verified", label: "Published" },
  { status: "in_progress", label: "In progress" },
  { status: "resolved", label: "Resolved" },
];

/** Where each status sits on the path. Under review (and legacy pre-publication reports) sit at the first step. */
const POSITION: Partial<Record<Status, number>> = { submitted: 0, under_review: 0, verified: 0, in_progress: 1, resolved: 2 };

/** Progress tracker for the normal path of a report. Each step says in text whether it is done. */
export default function ProgressSteps({ status }: { status: Status }) {
  const current = POSITION[status] ?? -1;
  if (current === -1) return null;

  return (
    <ol className="flex items-start" aria-label="Report progress">
      {STEPS.map((step, i) => {
        const done = i < current || status === "resolved";
        const active = i === current && status !== "resolved";
        return (
          <li key={step.status} className="relative flex flex-1 flex-col items-center text-center" aria-current={active ? "step" : undefined}>
            {i > 0 && <span className={`absolute right-1/2 top-3.5 h-0.5 w-full ${i <= current ? "bg-primary" : "bg-surface-3"}`} aria-hidden />}
            <span
              className={`relative z-10 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                done ? "bg-primary text-white" : active ? "bg-surface text-accent-strong ring-2 ring-primary" : "bg-surface-3 text-fg-muted ring-1 ring-line-strong"
              }`}
              aria-hidden
            >
              {done ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5 10 17.5 19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className={`mt-2 px-0.5 text-[11px] leading-tight sm:text-xs ${done || active ? "font-semibold text-fg" : "text-fg-muted"}`}>
              {step.label}
              <span className="sr-only">{done ? " (done)" : active ? " (current step)" : " (not yet)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
