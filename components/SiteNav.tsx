"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LogoutButton from "./LogoutButton";
import ThemeSwitcher from "./ThemeSwitcher";
import Icon, { type IconName } from "./ui/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

/** Active when on the page or below it ("/admin/users" lights up "/admin"); "/" only matches itself. */
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Closes a disclosure on Escape, outside click and navigation. */
function useDisclosure() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export default function SiteNav({
  items,
  user,
}: {
  items: NavItem[];
  user: { name: string; roleLabel: string | null } | null;
}) {
  const pathname = usePathname();
  const mobile = useDisclosure();
  const account = useDisclosure();

  const linkClass = (href: string) =>
    `inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
      isActive(pathname, href) ? "bg-accent-soft text-accent-strong" : "text-fg-muted hover:bg-surface-3 hover:text-fg"
    }`;

  return (
    <>
      <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={linkClass(i.href)} aria-current={isActive(pathname, i.href) ? "page" : undefined}>
            {i.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Link href="/report/new" className="btn btn-accent btn-sm sm:min-h-10 sm:px-4">
          <Icon name="plus" className="h-4 w-4" />
          <span>
            Report<span className="hidden sm:inline"> an issue</span>
          </span>
        </Link>

        {user ? (
          <div ref={account.ref} className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => account.setOpen(!account.open)}
              aria-expanded={account.open}
              aria-controls="account-menu"
              className="flex h-10 items-center gap-2 rounded-md px-2 text-sm hover:bg-surface-3"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-white" aria-hidden>
                {initials(user.name)}
              </span>
              <span className="max-w-[10rem] truncate font-semibold text-fg">{user.name}</span>
              <Icon name="chevronDown" className="h-4 w-4 text-fg-muted" />
            </button>
            <div
              id="account-menu"
              hidden={!account.open}
              className="animate-fade-up absolute right-0 top-full z-40 mt-2 w-60 rounded-lg border border-line bg-surface p-1.5 shadow-[var(--shadow-raised)]"
            >
              <div className="border-b border-line px-3 pb-2.5 pt-1.5">
                <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
                <p className="text-xs text-fg-muted">{user.roleLabel ?? "Citizen"}</p>
              </div>
              <MenuLink href="/me" icon="list">My reports</MenuLink>
              <MenuLink href="/account" icon="user">Account settings</MenuLink>
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-fg-muted">
                Theme
                <ThemeSwitcher compact />
              </div>
              <div className="mt-1 border-t border-line pt-1">
                <LogoutButton variant="menu" />
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden items-center gap-1 lg:flex">
            <ThemeSwitcher compact />
            <Link href="/login" className="btn btn-ghost btn-sm min-h-10">
              Log in
            </Link>
            <Link href="/register" className="btn btn-secondary btn-sm min-h-10">
              Sign up
            </Link>
          </div>
        )}

        <div ref={mobile.ref} className="lg:hidden">
          <button
            type="button"
            onClick={() => mobile.setOpen(!mobile.open)}
            aria-expanded={mobile.open}
            aria-controls="mobile-menu"
            aria-label={mobile.open ? "Close menu" : "Open menu"}
            className="grid h-10 w-10 place-items-center rounded-md text-fg-muted hover:bg-surface-3"
          >
            <Icon name={mobile.open ? "x" : "menu"} />
          </button>
          <div
            id="mobile-menu"
            hidden={!mobile.open}
            className="animate-fade-up absolute inset-x-0 top-full z-40 max-h-[calc(100svh-4rem)] overflow-y-auto border-b border-line bg-surface px-4 pb-4 pt-2 shadow-[var(--shadow-raised)]"
          >
            <nav aria-label="Main" className="flex flex-col gap-1">
              {items.map((i) => (
                <Link key={i.href} href={i.href} className={`${linkClass(i.href)} h-11`} aria-current={isActive(pathname, i.href) ? "page" : undefined}>
                  <Icon name={i.icon} className="h-4.5 w-4.5" />
                  {i.label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 border-t border-line px-3 pt-3">
              <ThemeSwitcher />
            </div>
            <div className="mt-3 border-t border-line pt-3">
              {user ? (
                <>
                  <p className="px-3 pb-2 text-sm">
                    <span className="font-semibold text-fg">{user.name}</span>
                    <span className="text-fg-muted"> · {user.roleLabel ?? "Citizen"}</span>
                  </p>
                  <Link href="/account" className={`${linkClass("/account")} h-11`}>
                    <Icon name="user" className="h-4.5 w-4.5" />
                    Account settings
                  </Link>
                  <LogoutButton variant="menu" />
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/login" className="btn btn-secondary">
                    Log in
                  </Link>
                  <Link href="/register" className="btn btn-primary">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: IconName; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-fg-muted hover:bg-surface-3">
      <Icon name={icon} className="h-4.5 w-4.5 text-fg-muted" />
      {children}
    </Link>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
