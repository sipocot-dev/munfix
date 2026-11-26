import Icon, { type IconName } from "./Icon";

export type Tone = "info" | "success" | "warning" | "danger" | "neutral";

const STYLE: Record<Tone, { box: string; icon: IconName }> = {
  info: { box: "border-line-strong bg-accent-soft text-accent-strong", icon: "info" },
  success: { box: "border-success-line bg-success-soft text-success", icon: "success" },
  warning: { box: "border-warning-line bg-warning-soft text-warning", icon: "alert" },
  danger: { box: "border-danger-line bg-danger-soft text-danger", icon: "alert" },
  neutral: { box: "border-line bg-surface-2 text-fg", icon: "info" },
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
