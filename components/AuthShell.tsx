import { MUNICIPALITY } from "@/lib/config";
import Icon, { type IconName } from "./ui/Icon";

const STEPS: [IconName, string, string][] = [
  ["camera", "Report", "Pin the spot on the map and add a photo."],
  ["shield", "Verified", "City staff check every report before it is published."],
  ["check", "Fixed", "Follow the work and get an email at each step."],
];

/** Two-column frame for log in, sign up and password pages. The side panel explains the service on wide screens. */
export default function AuthShell({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-10 sm:py-14 lg:grid-cols-[1fr_440px] lg:items-start lg:gap-16">
      <aside className="hidden lg:block">
        <p className="eyebrow">MunFix {MUNICIPALITY.name}</p>
        <p className="mt-3 text-3xl font-bold leading-tight tracking-tight text-slate-900 text-balance">
          Help keep {MUNICIPALITY.name}&apos;s streets, lights and drains in good repair.
        </p>
        <ol className="mt-8 space-y-5">
          {STEPS.map(([icon, label, text], i) => (
            <li key={label} className="flex gap-4">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-ink-700 text-white">
                <Icon name={icon} className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-slate-900">
                  {i + 1}. {label}
                </p>
                <p className="text-sm text-slate-600">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </aside>

      <div className="card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-slate-600">{description}</p>}
        {children}
      </div>
    </div>
  );
}
