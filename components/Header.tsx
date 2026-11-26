import Link from "next/link";
import { MUNICIPALITY } from "@/lib/config";
import { isStaffRole, ROLE_LABEL } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import SiteNav, { type NavItem } from "./SiteNav";
import Logo from "./ui/Logo";

export default async function Header() {
  const session = await getSession();
  const workspace = session && isStaffRole(session.role) && !session.mustChangePassword;

  const items: NavItem[] = [
    { href: "/", label: "Map", icon: "map" },
    ...(session ? [{ href: "/me", label: "My reports", icon: "list" } as NavItem] : []),
    ...(workspace
      ? [{ href: "/admin", label: session.role === "staff" ? "Work queue" : session.role === "admin" ? "Administration" : "Moderation", icon: "queue" } as NavItem]
      : []),
    { href: "/about", label: "How it works", icon: "info" },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="relative flex h-16 items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex flex-none items-center gap-2.5 rounded-md" aria-label={`MunFix ${MUNICIPALITY.name}, home`}>
            <Logo />
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight text-slate-900">MunFix</span>
              <span className="block text-xs font-medium text-slate-500">{MUNICIPALITY.name}, {MUNICIPALITY.province}</span>
            </span>
          </Link>
          <SiteNav
            items={items}
            user={session ? { name: session.name, roleLabel: session.role === "citizen" ? null : ROLE_LABEL[session.role] } : null}
          />
        </div>
      </header>

      {session?.mustChangePassword && (
        <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-950">
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
