import type { Metadata } from "next";
import TestEmailButton from "@/components/TestEmailButton";
import Alert from "@/components/ui/Alert";
import PageHeader from "@/components/ui/PageHeader";
import { requirePagePermission } from "@/lib/guards";
import { getSystemStatus } from "@/lib/system";

export const metadata: Metadata = { title: "System" };

function State({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-2 text-sm text-fg-muted">
      <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${ok ? "bg-green-600" : "bg-red-600"}`} aria-hidden />
      <span>
        <span className={`font-semibold ${ok ? "text-success" : "text-danger"}`}>{ok ? "Working" : "Problem"}</span> · {children}
      </span>
    </p>
  );
}

export default async function SystemPage() {
  await requirePagePermission("/admin/system", "system.view");
  const s = await getSystemStatus();

  return (
    <>
      <PageHeader title="System" description="Health of the services MunFix depends on, and what is configured. Read-only: settings are changed in the hosting environment." />

      {(s.adminsWithTempPassword > 0 || s.demoAccounts > 0) && (
        <Alert tone="warning" className="mb-6" live={false} title="Before going live">
          <ul className="list-disc space-y-1 pl-5">
            {s.adminsWithTempPassword > 0 && <li>{s.adminsWithTempPassword} administrator account(s) still use a temporary password.</li>}
            {s.demoAccounts > 0 && <li>{s.demoAccounts} demo account(s) (@munfix.local) exist. Deactivate them on the Users page.</li>}
          </ul>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Database (PostgreSQL)</h2>
          <State ok={s.database.ok}>{s.database.detail}</State>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Sessions and cache (Redis)</h2>
          <State ok={s.redis.ok}>{s.redis.detail}</State>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Photo storage</h2>
          <p className="mt-2 text-sm text-fg-muted">
            <span className="font-semibold">{s.storage.driver}</span> · {s.storage.detail}
          </p>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Email</h2>
          <State ok={s.mail.enabled}>
            {s.mail.enabled ? `${s.mail.pending} waiting to send · ${s.mail.failed} gave up` : "Not configured (set SMTP_URL and MAIL_FROM). Password reset and status emails are off."}
          </State>
          {s.mail.enabled && <TestEmailButton />}
        </section>
      </div>

      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Social sign-in</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Public site address: <code className="rounded bg-surface-3 px-1.5 py-0.5 text-[13px]">{s.appUrl}</code>. Register these exact redirect URIs in each provider&apos;s console.
        </p>
        <ul className="mt-4 divide-y divide-line">
          {s.providers.map((p) => (
            <li key={p.id} className="py-3 first:pt-0 last:pb-0">
              <p className="font-semibold capitalize">{p.id}</p>
              <State ok={p.configured}>{p.configured ? "Credentials set; the button shows on the log in page." : "Not configured; the button is hidden."}</State>
              <code className="mt-2 block break-all rounded bg-surface-3 px-2 py-1.5 text-[13px]">{p.redirectUri}</code>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
