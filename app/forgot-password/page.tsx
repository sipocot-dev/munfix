import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/PasswordResetForms";
import { mailEnabled } from "@/lib/mail";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="card p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
        <p className="mt-1 text-sm text-slate-600">Enter your email and we will send you a link to choose a new one.</p>
        <ForgotForm emailEnabled={mailEnabled()} />
        <p className="mt-5 text-center text-sm">
          <Link href="/login" className="font-semibold text-ink-700 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
