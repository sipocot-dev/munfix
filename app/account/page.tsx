import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccount, PasswordForm, ProfileForm } from "@/components/AccountForms";
import NotificationToggle from "@/components/NotificationToggle";
import { getAccount } from "@/lib/accounts";
import { formatDate } from "@/lib/format";
import { mailEnabled } from "@/lib/mail";
import { isStaffRole, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");
  const account = await getAccount(session.userId);
  if (!account) redirect("/login");
  const forced = session.mustChangePassword === true;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">{forced ? "Choose a new password" : "My account"}</h1>

      {forced && (
        <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your account uses a temporary password. Set a new one to continue — until then the rest of the site is locked for this account.
        </p>
      )}
      {!forced && (await searchParams).reason === "password" && (
        <p className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-900">Your password is up to date.</p>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-semibold">{forced ? "New password" : "Password"}</h2>
        <PasswordForm hasPassword={account.hasPassword} forced={forced} />
        {!account.hasPassword && (
          <p className="text-xs text-slate-500">You signed up with {account.providers.join(" / ") || "a provider"}. Setting a password lets you also log in with email.</p>
        )}
      </section>

      {!forced && (
        <>
          <section className="card space-y-3 p-5">
            <h2 className="text-lg font-semibold">Profile</h2>
            <p className="text-sm text-slate-600">
              {account.email} · member since {formatDate(account.createdAt)}
            </p>
            <p className="text-sm">
              <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs font-semibold text-ink-800">{ROLE_LABEL[account.role]}</span>{" "}
              <span className="text-slate-600">{ROLE_DESCRIPTION[account.role]}</span>
            </p>
            <ProfileForm name={account.name} />
            {account.providers.length > 0 && (
              <p className="text-sm text-slate-600">Connected sign-in: {account.providers.map((p) => (p === "google" ? "Google" : "Facebook")).join(", ")}</p>
            )}
          </section>

          {mailEnabled() && <NotificationToggle initial={account.emailNotifications} />}

          <section className="card space-y-3 p-5">
            <h2 className="text-lg font-semibold">Delete account</h2>
            {isStaffRole(account.role) ? (
              <p className="text-sm text-slate-600">Staff and administrator accounts cannot be deleted here. Ask an administrator to change your role first.</p>
            ) : (
              <DeleteAccount />
            )}
            <p className="text-xs text-slate-500">
              See our <Link href="/privacy" className="underline">privacy policy</Link> and <Link href="/data-deletion" className="underline">data deletion instructions</Link>.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
