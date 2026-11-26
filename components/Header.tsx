import Link from "next/link";
import { MUNICIPALITY } from "@/lib/config";
import { canOpen, WORKSPACE_AREAS } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import SiteNav, { type NavItem } from "./SiteNav";
import Logo from "./ui/Logo";

export default async function Header() {
  const session = await getSession();
  const perms = session?.permissions ?? [];
  // The first workspace page this user may open; custom roles can hold any combination of permissions.
  const workspace = WORKSPACE_AREAS.find((a) => canOpen(perms, a.anyOf));
  const workspaceLabel = perms.includes("users.manage") || perms.includes("roles.manage")
    ? "Administration"
    : perms.includes("reports.review")
      ? "Moderation"
      : perms.includes("reports.work")
        ? "Work queue"
        : "Workspace";

  const items: NavItem[] = [
    { href: "/", label: "Map", icon: "map" },
    ...(session ? [{ href: "/me", label: "My reports", icon: "list" } as NavItem] : []),
    ...(workspace
      ? [{ href: workspace.href, label: workspaceLabel, icon: "queue" } as NavItem]
      : []),
    { href: "/about", label: "How it works", icon: "info" },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="relative flex h-16 items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex flex-none items-center gap-2.5 rounded-md">
            <Logo />
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight text-fg">MunFix</span>
              <span className="block text-xs font-medium text-fg-muted">{MUNICIPALITY.name}, {MUNICIPALITY.province}</span>
            </span>
          </Link>
          <SiteNav
            items={items}
            user={session ? { name: session.name, roleLabel: session.role === "citizen" ? null : session.roleName } : null}
          />
        </div>
      </header>

      {session?.mustChangePassword && (
        <div role="alert" className="border-b border-warning-line bg-warning-soft px-4 py-2.5 text-center text-sm text-warning">
          You are using a temporary password.{" "}
          <Link href="/account?reason=password" className="font-semibold underline underline-offset-2">
            Choose a new password
          </Link>{" "}
          to continue.
        </div>
      )}
    </>
  );
}
