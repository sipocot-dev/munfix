import Link from "next/link";
import { MUNICIPALITY } from "@/lib/config";
import { getSession } from "@/lib/session";
import LogoutButton from "./LogoutButton";

export default async function Header() {
  const session = await getSession();

  return (
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
          {session?.role === "admin" && (
            <>
              <Link href="/admin" className="rounded-md px-3 py-1.5 hover:bg-slate-100">
                Moderation
              </Link>
              <Link href="/admin/audit" className="rounded-md px-3 py-1.5 hover:bg-slate-100">
                Audit log
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          <Link href="/report/new" className="btn btn-primary !py-1.5">
            Report an issue
          </Link>
          {session ? (
            <>
              <span className="hidden max-w-[10rem] truncate text-slate-600 sm:inline">{session.name}</span>
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
  );
}
