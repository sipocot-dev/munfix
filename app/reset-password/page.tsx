import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/PasswordResetForms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="card p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
        {token ? (
          <ResetForm token={token} />
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            This link is incomplete.{" "}
            <Link href="/forgot-password" className="font-semibold text-ink-700 hover:underline">
              Request a new reset link
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
