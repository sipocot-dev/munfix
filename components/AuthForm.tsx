"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiError, safeNext } from "@/lib/client";

interface ProviderLink {
  id: string;
  label: string;
}

function ProviderIcon({ id }: { id: string }) {
  if (id === "google") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.9a5.05 5.05 0 0 1-2.19 3.31v2.75h3.54c2.07-1.91 3.25-4.72 3.25-8.09Z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.75c-.98.66-2.24 1.05-3.74 1.05-2.87 0-5.3-1.94-6.17-4.55H2.17v2.84A11 11 0 0 0 12 23Z" />
        <path fill="#FBBC05" d="M5.83 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.17a11 11 0 0 0 0 9.86l3.66-2.84Z" />
        <path fill="#EA4335" d="M12 5.36c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.17 7.07l3.66 2.84C6.7 7.3 9.13 5.36 12 5.36Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.8-4.67 4.53-4.67 1.31 0 2.69.23 2.69.23v2.95h-1.52c-1.49 0-1.96.93-1.96 1.87V12h3.34l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12Z" />
    </svg>
  );
}

export default function AuthForm({
  mode,
  next,
  providers = [],
  notice,
}: {
  mode: "login" | "register";
  next?: string;
  providers?: ProviderLink[];
  notice?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(notice ?? null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";
  const target = safeNext(next);
  const nextQuery = next ? `?next=${encodeURIComponent(target)}` : "";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const res = await fetch(`/api/v1/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiError(data));
        return;
      }
      if (data.mustChangePassword) router.push("/account?reason=password");
      else router.push(["admin", "moderator", "staff"].includes(data.role) && target === "/" ? "/admin" : target);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="card p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {isLogin
            ? "Log in to submit reports and follow their progress."
            : "An account lets you submit reports and follow them until they are resolved."}
        </p>

        {providers.length > 0 && (
          <div className="mt-6 space-y-2">
            {providers.map((p) => (
              <a
                key={p.id}
                href={`/api/v1/auth/oauth/${p.id}${next ? `?next=${encodeURIComponent(target)}` : ""}`}
                className="btn btn-secondary w-full"
              >
                <ProviderIcon id={p.id} />
                Continue with {p.label}
              </a>
            ))}
            <div className="flex items-center gap-3 pt-2 text-xs uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or use email
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {!isLogin && (
            <label className="block text-sm font-medium">
              Full name
              <input name="name" required minLength={2} maxLength={80} autoComplete="name" className="field mt-1" />
            </label>
          )}
          <label className="block text-sm font-medium">
            Email
            <input name="email" type="email" required autoComplete="email" className="field mt-1" />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={isLogin ? 1 : 8}
              autoComplete={isLogin ? "current-password" : "new-password"}
              className="field mt-1"
            />
            {!isLogin && <span className="mt-1 block text-xs font-normal text-slate-500">At least 8 characters.</span>}
            {isLogin && (
              <Link href="/forgot-password" className="mt-1 inline-block text-xs font-semibold text-ink-700 hover:underline">
                Forgot your password?
              </Link>
            )}
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          {isLogin ? "New here? " : "Already have an account? "}
          <Link href={`${isLogin ? "/register" : "/login"}${nextQuery}`} className="font-semibold text-ink-700 hover:underline">
            {isLogin ? "Create an account" : "Log in"}
          </Link>
        </p>
      </div>
    </div>
  );
}
