import type { Metadata } from "next";
import AdminNav from "@/components/AdminNav";
import TestEmailButton from "@/components/TestEmailButton";
import { requirePageRole } from "@/lib/guards";
import { getSystemStatus } from "@/lib/system";

export const metadata: Metadata = { title: "System" };

function Dot({ ok }: { ok: boolean }) {
  return <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} aria-label={ok ? "OK" : "Problem"} />;
}

export default async function SystemPage() {
  const session = await requirePageRole("/admin/system", "admin");
  const s = await getSystemStatus();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">System</h1>
      <p className="mt-2 mb-4 text-slate-600">Health of the services MunFix depends on, and what is configured.</p>
      <AdminNav role={session.role} current="/admin/system" />

      {(s.adminsWithTempPassword > 0 || s.demoAccounts > 0) && (
        <div role="alert" className="mb-6 space-y-1 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {s.adminsWithTempPassword > 0 && <p>{s.adminsWithTempPassword} administrator account(s) still use a temporary password and have never set their own.</p>}
          {s.demoAccounts > 0 && <p>{s.demoAccounts} demo account(s) (@munfix.local) exist. Deactivate them on the Users page before going live.</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card p-5"><h2 className="font-semibold">PostgreSQL</h2><p className="mt-1 text-sm"><Dot ok={s.database.ok} />{s.database.detail}</p></section>
        <section className="card p-5"><h2 className="font-semibold">Redis</h2><p className="mt-1 text-sm"><Dot ok={s.redis.ok} />{s.redis.detail}</p></section>
        <section className="card p-5"><h2 className="font-semibold">Photo storage</h2><p className="mt-1 text-sm">{s.storage.driver}: {s.storage.detail}</p></section>
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Email</h2>
          <p className="text-sm"><Dot ok={s.mail.enabled} />{s.mail.enabled ? `Configured · ${s.mail.pending} pending · ${s.mail.failed} gave up` : "Not configured (set SMTP_URL and MAIL_FROM). Password reset and status emails are off."}</p>
          {s.mail.enabled && <TestEmailButton />}
        </section>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="text-lg font-semibold">Social sign-in</h2>
        <p className="mt-1 text-sm text-slate-600">Public site address: <code>{s.appUrl}</code>. Add these exact redirect URIs in each provider&apos;s console.</p>
        <ul className="mt-3 space-y-3 text-sm">
          {s.providers.map((p) => (
            <li key={p.id}>
              <p className="font-semibold capitalize"><Dot ok={p.configured} />{p.id} — {p.configured ? "credentials set, button visible on the login page" : "not configured (button hidden)"}</p>
              <code className="mt-1 block break-all rounded bg-slate-100 px-2 py-1">{p.redirectUri}</code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
