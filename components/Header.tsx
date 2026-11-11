import Link from "next/link";
import { MUNICIPALITY } from "@/lib/config";
import { isStaffRole, ROLE_LABEL } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import LogoutButton from "./LogoutButton";

export default async function Header() {
  const session = await getSession();
  const staff = isStaffRole(session?.role);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-white" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            </span>
            <span>
              MunFix <span className="font-medium text-teal-700">{MUNICIPALITY.name}</span>
            </span>
          </Link>

          <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm font-medium text-slate-600">
            <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-slate-100">
              Map
            </Link>
            {session && (
              <Link href="/me" className="rounded-md px-3 py-1.5 hover:bg-slate-100">
                My reports
              </Link>
            )}
            {session && staff && !session.mustChangePassword && (
              <Link href="/admin" className="rounded-md px-3 py-1.5 hover:bg-slate-100">
                {session.role === "admin" ? "Admin" : session.role === "staff" ? "Work queue" : "Moderation"}
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2 text-sm">
            <Link href="/report/new" className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3.5 py-1.5 font-semibold text-white hover:bg-orange-700">
              <span aria-hidden>+</span> Report Issue
            </Link>
            {session ? (
              <>
                <Link href="/account" className="hidden items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100 sm:flex">
                  <span className="max-w-[9rem] truncate text-slate-700">{session.name}</span>
                  {session.role !== "citizen" && (
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800">{ROLE_LABEL[session.role]}</span>
                  )}
                </Link>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-secondary !py-1.5">
                  Log in
                </Link>
                <Link href="/register" className="hidden font-medium text-teal-700 hover:underline sm:inline">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {session?.mustChangePassword && (
        <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          You are using a temporary password.{" "}
          <Link href="/account?reason=password" className="font-semibold underline">
            Choose a new password
          </Link>{" "}
          to continue.
        </div>
      )}
    </>
  );
}
