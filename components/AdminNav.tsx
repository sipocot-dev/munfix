import Link from "next/link";
import type { Role } from "@/lib/permissions";

const ITEMS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/admin", label: "Work queue", roles: ["moderator", "staff", "admin"] },
  { href: "/admin/overview", label: "Overview", roles: ["moderator", "admin"] },
  { href: "/admin/users", label: "Users", roles: ["admin"] },
  { href: "/admin/audit", label: "Audit log", roles: ["admin"] },
  { href: "/admin/system", label: "System", roles: ["admin"] },
];

/** Sub-navigation shared by the staff workspace pages. */
export default function AdminNav({ role, current }: { role: Role; current: string }) {
  return (
    <nav aria-label="Workspace" className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
      {ITEMS.filter((i) => i.roles.includes(role)).map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.href === current ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
            i.href === current ? "border-ink-600 text-ink-800" : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
