import Icon, { type IconName } from "./Icon";

/** For lists with nothing in them. Says what is missing and, when possible, what to do next. */
export default function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className = "",
}: {
  icon?: IconName;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card flex flex-col items-center px-6 py-12 text-center ${className}`}>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-ink-50 text-ink-700">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
