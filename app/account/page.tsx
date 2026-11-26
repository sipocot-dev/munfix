import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccount, PasswordForm, ProfileForm } from "@/components/AccountForms";
import NotificationToggle from "@/components/NotificationToggle";
import Alert from "@/components/ui/Alert";
import PageHeader from "@/components/ui/PageHeader";
import { getAccount } from "@/lib/accounts";
import { formatDate } from "@/lib/format";
import { mailEnabled } from "@/lib/mail";
import { resolveRole } from "@/lib/roles";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Account settings" };

const PROVIDER_LABEL: Record<string, string> = { google: "Google", facebook: "Facebook" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");
  const account = await getAccount(session.userId);
  if (!account) redirect("/login");
  const forced = session.mustChangePassword === true;
  const role = await resolveRole(account.role);
  const providers = account.providers.map((p) => PROVIDER_LABEL[p] ?? p);

  return (
    <div className="container-page container-narrow">
      <PageHeader title={forced ? "Choose a new password" : "Account settings"} description={forced ? undefined : `${account.email} · member since ${formatDate(account.createdAt)}`} />

      <div className="space-y-6">
        {forced && (
          <Alert tone="warning" live={false} title="Your account uses a temporary password">
            Choose your own password to continue. Until then the rest of MunFix is locked for this account.
          </Alert>
        )}
        {!forced && (await searchParams).reason === "password" && <Alert tone="success" title="Your password is up to date." />}

        {!forced && (
          <Panel title="Profile">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-strong">{role.name}</span>
              <span className="text-fg-muted">{role.description}</span>
            </div>
            <ProfileForm name={account.name} />
            {providers.length > 0 && <p className="mt-4 text-sm text-fg-muted">Connected sign-in: {providers.join(", ")}</p>}
          </Panel>
        )}

        <Panel title={forced ? "New password" : "Password"} description={!account.hasPassword ? `You signed up with ${providers.join(" / ") || "a sign-in provider"}. Setting a password lets you also log in with your email.` : undefined}>
          <PasswordForm hasPassword={account.hasPassword} forced={forced} />
        </Panel>

        {!forced && mailEnabled() && <NotificationToggle initial={account.emailNotifications} />}

        {!forced && (
          <Panel title="Delete account" danger>
            {role.permissions.length > 0 ? (
              <p className="text-sm text-fg-muted">Staff and administrator accounts cannot be deleted here. Ask an administrator to change your role first.</p>
            ) : (
              <DeleteAccount />
            )}
            <p className="mt-4 text-sm text-fg-muted">
              See the <Link href="/privacy" className="link">privacy policy</Link> and the <Link href="/data-deletion" className="link">data deletion instructions</Link>.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Panel({ title, description, danger, children }: { title: string; description?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section className={`card p-5 sm:p-6 ${danger ? "border-danger-line" : ""}`} aria-label={title}>
      <h2 className={`text-lg font-semibold ${danger ? "text-danger" : "text-fg"}`}>{title}</h2>
      {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
