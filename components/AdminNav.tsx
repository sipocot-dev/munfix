"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/permissions";
import Icon, { type IconName } from "./ui/Icon";

const ITEMS: { href: string; label: string; icon: IconName; roles: Role[] }[] = [
  { href: "/admin", label: "Work queue", icon: "queue", roles: ["moderator", "staff", "admin"] },
  { href: "/admin/overview", label: "Overview", icon: "chart", roles: ["moderator", "admin"] },
  { href: "/admin/users", label: "Users & roles", icon: "users", roles: ["admin"] },
  { href: "/admin/audit", label: "Audit log", icon: "history", roles: ["admin"] },
  { href: "/admin/system", label: "System", icon: "settings", roles: ["admin"] },
];

export function workspaceItems(role: Role) {
  return ITEMS.filter((i) => i.roles.includes(role));
}

/** Workspace tabs, shown by app/admin/layout.tsx. Scrolls sideways on narrow phones instead of wrapping. */
export default function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = workspaceItems(role);
  if (items.length < 2) return null;
  return (
    <nav aria-label="Workspace" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-slate-200">
        {items.map((i) => {
          const current = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={current ? "page" : undefined}
                className={`-mb-px flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors ${
                  current ? "border-ink-700 text-ink-800" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <Icon name={i.icon} className="h-4.5 w-4.5" />
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
