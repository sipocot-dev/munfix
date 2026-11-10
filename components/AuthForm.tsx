"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiError, safeNext } from "@/lib/client";

export default function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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
      router.push(data.role === "admin" && target === "/" ? "/admin" : target);
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
          <Link href={`${isLogin ? "/register" : "/login"}${nextQuery}`} className="font-semibold text-teal-700 hover:underline">
            {isLogin ? "Create an account" : "Log in"}
          </Link>
        </p>
      </div>
    </div>
  );
}
