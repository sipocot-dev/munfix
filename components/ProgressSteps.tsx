import type { Status } from "@/lib/status";

const STEPS: { status: Status; label: string }[] = [
  { status: "submitted", label: "Submitted" },
  { status: "under_review", label: "Under review" },
  { status: "verified", label: "Verified" },
  { status: "in_progress", label: "In progress" },
  { status: "resolved", label: "Resolved" },
];

/** Horizontal progress tracker for the happy path of a report. */
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
            {i > 0 && (
              <span
                className={`absolute right-1/2 top-3 h-0.5 w-full ${i <= current ? "bg-ink-600" : "bg-slate-200"}`}
                aria-hidden
              />
            )}
            <span
              className={`relative z-10 grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                done ? "bg-ink-600 text-white" : active ? "bg-white text-ink-700 ring-2 ring-ink-600" : "bg-slate-200 text-slate-400"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`mt-1.5 text-[11px] leading-tight sm:text-xs ${done || active ? "font-semibold text-slate-900" : "text-slate-400"}`}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
