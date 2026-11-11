"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiError } from "@/lib/client";

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
      <p className="mt-6 rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-900">
        Password reset by email is not set up on this site. Please contact the city administrator to have your password reset.
      </p>
    );
  }

  if (sent) {
    return (
      <p role="status" className="mt-6 rounded-lg bg-ink-50 px-3 py-3 text-sm text-ink-900">
        If an account exists for that email, we have sent a link to reset the password. It is valid for one hour. Check your spam folder if it does not arrive.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" required autoComplete="email" className="field mt-1" />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
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
      <p role="status" className="mt-6 rounded-lg bg-ink-50 px-3 py-3 text-sm text-ink-900">
        Your password was changed. Redirecting you to log in…{" "}
        <Link href="/login" className="font-semibold underline">
          Log in now
        </Link>
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm font-medium">
        New password
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="field mt-1" />
        <span className="mt-1 block text-xs font-normal text-slate-500">At least 8 characters.</span>
      </label>
      <label className="block text-sm font-medium">
        Confirm new password
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="field mt-1" />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
