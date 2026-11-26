"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./ui/Icon";

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Work queue", icon: "queue" },
  { href: "/admin/overview", label: "Overview", icon: "chart" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/roles", label: "Roles", icon: "shield" },
  { href: "/admin/audit", label: "Audit log", icon: "history" },
  { href: "/admin/system", label: "System", icon: "settings" },
];

/**
 * Workspace tabs, shown by app/admin/layout.tsx. `areas` are the pages this user's permissions open
 * (WORKSPACE_AREAS in lib/permissions.ts). Scrolls sideways on narrow phones instead of wrapping.
 */
export default function AdminNav({ areas }: { areas: string[] }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => areas.includes(i.href));
  if (items.length < 2) return null;
  return (
    <nav aria-label="Workspace" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {items.map((i) => {
          const current = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={current ? "page" : undefined}
                className={`-mb-px flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors ${
                  current ? "border-primary text-accent-strong" : "border-transparent text-fg-muted hover:border-line-strong hover:text-fg"
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
