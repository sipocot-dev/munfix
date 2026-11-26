import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { ForgotForm } from "@/components/PasswordResetForms";
import { mailEnabled } from "@/lib/mail";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" description="Enter the email you signed up with and we will send you a link to choose a new one.">
      <ForgotForm emailEnabled={mailEnabled()} />
      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm">
        <Link href="/login" className="link">
          Back to log in
        </Link>
      </p>
    </AuthShell>
  );
}
