import Icon, { type IconName } from "./Icon";

export type Tone = "info" | "success" | "warning" | "danger" | "neutral";

const STYLE: Record<Tone, { box: string; icon: IconName }> = {
  info: { box: "border-ink-200 bg-ink-50 text-ink-900", icon: "info" },
  success: { box: "border-green-200 bg-green-50 text-green-900", icon: "success" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-950", icon: "alert" },
  danger: { box: "border-red-200 bg-red-50 text-red-800", icon: "alert" },
  neutral: { box: "border-slate-200 bg-slate-50 text-slate-800", icon: "info" },
};

/**
 * Inline message. Errors announce themselves (role="alert"); everything else is a polite status,
 * so screen readers hear success without being interrupted.
 */
export default function Alert({
  tone = "info",
  title,
  children,
  className = "",
  live = true,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  /** false for static notices that are part of the page, not a reaction to something the user did. */
  live?: boolean;
}) {
  const s = STYLE[tone];
  const role = !live ? undefined : tone === "danger" ? "alert" : "status";
  return (
    <div role={role} className={`flex gap-3 rounded-lg border px-3.5 py-3 text-sm ${s.box} ${className}`}>
      <Icon name={s.icon} className="mt-0.5 h-4.5 w-4.5 flex-none" />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
