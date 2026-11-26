import Icon, { type IconName } from "./Icon";

/**
 * A single figure. Pass null when the number could not be loaded: it shows "—" with an explanation,
 * never a zero that would read as "nothing happened".
 */
export default function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "#1d3557",
}: {
  label: string;
  value: number | string | null;
  hint?: string;
  icon?: IconName;
  accent?: string;
}) {
  const missing = value === null;
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-fg-muted">{label}</p>
        {icon && (
          <span className="tone-icon grid h-8 w-8 place-items-center rounded-md" style={{ "--c": accent } as React.CSSProperties}>
            <Icon name={icon} className="h-4.5 w-4.5" />
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-fg">{missing ? "—" : value}</p>
      {(missing || hint) && <p className="mt-1 text-xs text-fg-muted">{missing ? "Not available right now" : hint}</p>}
    </div>
  );
}
