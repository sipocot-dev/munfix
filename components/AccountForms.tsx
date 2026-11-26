"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiError } from "@/lib/client";
import Alert from "./ui/Alert";
import { useToast } from "./ui/Feedback";
import FormField from "./ui/FormField";
import PasswordInput from "./ui/PasswordInput";
import Spinner from "./ui/Spinner";

const OFFLINE = "Could not reach the server. Check your connection and try again.";

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (value === name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
      if (!res.ok) return setError(apiError(await res.json().catch(() => ({}))));
      toast("Your name was saved.");
      router.refresh();
    } catch {
      setError(OFFLINE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Display name" hint="Seen by city staff. Never shown on public reports.">
        <input name="name" defaultValue={name} required minLength={2} maxLength={80} autoComplete="name" className="field sm:max-w-sm" />
      </FormField>
      {error && <Alert tone="danger">{error}</Alert>}
      <button type="submit" disabled={busy} className="btn btn-secondary btn-sm">
        {busy && <Spinner />}
        {busy ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

export function PasswordForm({ hasPassword, forced }: { hasPassword: boolean; forced: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get("newPassword") !== f.get("confirm")) return setError("The two new passwords do not match.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: f.get("currentPassword") || undefined, newPassword: f.get("newPassword") }),
      });
      if (!res.ok) return setError(apiError(await res.json().catch(() => ({}))));
      form.reset();
      toast("Password changed. Other devices were signed out.");
      router.push("/account");
      router.refresh();
    } catch {
      setError(OFFLINE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 sm:max-w-sm">
      {hasPassword && (
        <FormField label={forced ? "Temporary password" : "Current password"}>
          <PasswordInput name="currentPassword" required autoComplete="current-password" />
        </FormField>
      )}
      <FormField label="New password" hint="At least 8 characters. Avoid common passwords.">
        <PasswordInput name="newPassword" required minLength={8} maxLength={128} autoComplete="new-password" />
      </FormField>
      <FormField label="Confirm new password">
        <PasswordInput name="confirm" required minLength={8} maxLength={128} autoComplete="new-password" />
      </FormField>
      {error && <Alert tone="danger">{error}</Alert>}
      <button type="submit" disabled={busy} className="btn btn-primary">
        {busy && <Spinner />}
        {busy ? "Saving…" : hasPassword ? "Change password" : "Set password"}
      </button>
    </form>
  );
}

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) return setError(apiError(await res.json().catch(() => ({}))));
      router.push("/");
      router.refresh();
    } catch {
      setError(OFFLINE);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-danger btn-sm">
        Delete my account…
      </button>
    );
  }
  return (
    <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm leading-relaxed text-red-900">
        This removes your name and email and signs you out everywhere. Reports still awaiting review are withdrawn; published reports stay on the public map without your name. <strong>This cannot be undone.</strong>
      </p>
      <FormField label="Type DELETE to confirm">
        <input value={text} onChange={(e) => setText(e.target.value)} className="field sm:max-w-xs" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      </FormField>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || text !== "DELETE"} onClick={remove} className="btn btn-danger-solid btn-sm">
          {busy && <Spinner />}
          {busy ? "Deleting…" : "Permanently delete my account"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
