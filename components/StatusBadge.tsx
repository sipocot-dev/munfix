import { STATUS_COLOR, STATUS_HELP, STATUS_LABEL, STATUS_TEXT, type Status } from "@/lib/status";

export default function StatusBadge({ status, size = "sm" }: { status: Status; size?: "sm" | "md" }) {
  return (
    <span
      title={STATUS_HELP[status]}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"}`}
      style={{ color: STATUS_TEXT[status], backgroundColor: `${STATUS_COLOR[status]}1a` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
