import type { Status } from "@/lib/status";

const STEPS: { status: Status; label: string }[] = [
  { status: "submitted", label: "Submitted" },
  { status: "under_review", label: "Under review" },
  { status: "verified", label: "Verified" },
  { status: "in_progress", label: "In progress" },
  { status: "resolved", label: "Resolved" },
];

/** Progress tracker for the normal path of a report. Each step says in text whether it is done. */
export default function ProgressSteps({ status }: { status: Status }) {
  const current = STEPS.findIndex((s) => s.status === status);
  if (current === -1) return null;

  return (
    <ol className="flex items-start" aria-label="Report progress">
      {STEPS.map((step, i) => {
        const done = i < current || status === "resolved";
        const active = i === current && status !== "resolved";
        return (
          <li key={step.status} className="relative flex flex-1 flex-col items-center text-center" aria-current={active ? "step" : undefined}>
            {i > 0 && <span className={`absolute right-1/2 top-3.5 h-0.5 w-full ${i <= current ? "bg-ink-700" : "bg-slate-200"}`} aria-hidden />}
            <span
              className={`relative z-10 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                done ? "bg-ink-700 text-white" : active ? "bg-white text-ink-800 ring-2 ring-ink-700" : "bg-slate-100 text-slate-500 ring-1 ring-slate-300"
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
            <span className={`mt-2 px-0.5 text-[11px] leading-tight sm:text-xs ${done || active ? "font-semibold text-slate-900" : "text-slate-500"}`}>
              {step.label}
              <span className="sr-only">{done ? " (done)" : active ? " (current step)" : " (not yet)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
