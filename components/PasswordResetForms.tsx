"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiError } from "@/lib/client";
import Alert from "./ui/Alert";
import FormField from "./ui/FormField";
import PasswordInput from "./ui/PasswordInput";
import Spinner from "./ui/Spinner";

export function ForgotForm({ emailEnabled }: { emailEnabled: boolean }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: new FormData(e.currentTarget).get("email") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(apiError(data));
      else setSent(true);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!emailEnabled) {
    return (
      <Alert tone="warning" className="mt-6" live={false} title="Email is not set up on this site">
        Contact the municipal office or the site administrator to have your password reset.
      </Alert>
    );
  }

  if (sent) {
    return (
      <Alert tone="success" className="mt-6" title="Check your email">
        If an account exists for that address, we have sent a link to choose a new password. It works for one hour. Check your spam folder if it does not arrive.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <FormField label="Email">
        <input name="email" type="email" required autoComplete="email" inputMode="email" className="field" />
      </FormField>
      {error && <Alert tone="danger">{error}</Alert>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy && <Spinner />}
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (form.get("password") !== form.get("confirm")) return setError("The two passwords do not match.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.get("password") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(apiError(data));
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Alert tone="success" className="mt-6" title="Password changed">
        Taking you to the log in page…{" "}
        <Link href="/login" className="font-semibold underline">
          Log in now
        </Link>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <FormField label="New password" hint="At least 8 characters. Avoid common passwords.">
        <PasswordInput name="password" required minLength={8} maxLength={128} autoComplete="new-password" />
      </FormField>
      <FormField label="Confirm new password">
        <PasswordInput name="confirm" required minLength={8} maxLength={128} autoComplete="new-password" />
      </FormField>
      {error && <Alert tone="danger">{error}</Alert>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy && <Spinner />}
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
