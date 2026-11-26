import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { ResetForm } from "@/components/PasswordResetForms";
import Alert from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Choose a new password">
      {token ? (
        <ResetForm token={token} />
      ) : (
        <Alert tone="warning" className="mt-5" live={false} title="This link is incomplete">
          Copy the whole link from the email, or{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            request a new reset link
          </Link>
          .
        </Alert>
      )}
    </AuthShell>
  );
}
