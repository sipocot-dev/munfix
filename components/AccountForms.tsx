"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiError } from "@/lib/client";

function Msg({ ok, text }: { ok: boolean; text: string | null }) {
  if (!text) return null;
  return (
    <p role={ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${ok ? "bg-ink-50 text-ink-900" : "bg-red-50 text-red-700"}`}>
      {text}
    </p>
  );
}

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: new FormData(e.currentTarget).get("name") }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: "Name saved." } : { ok: false, text: apiError(data) });
      if (res.ok) router.refresh();
    } catch {
      setMsg({ ok: false, text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium">
        Display name
        <input name="name" defaultValue={name} required minLength={2} maxLength={80} className="field mt-1" />
      </label>
      <Msg ok={msg?.ok ?? false} text={msg?.text ?? null} />
      <button type="submit" disabled={busy} className="btn btn-secondary">
        {busy ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

export function PasswordForm({ hasPassword, forced }: { hasPassword: boolean; forced: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get("newPassword") !== f.get("confirm")) return setMsg({ ok: false, text: "The two passwords do not match." });
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: f.get("currentPassword") || undefined, newPassword: f.get("newPassword") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ ok: false, text: apiError(data) });
      form.reset();
      setMsg({ ok: true, text: "Password changed. Other devices were signed out." });
      router.push("/account");
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {hasPassword && (
        <label className="block text-sm font-medium">
          {forced ? "Temporary password" : "Current password"}
          <input name="currentPassword" type="password" required autoComplete="current-password" className="field mt-1" />
        </label>
      )}
      <label className="block text-sm font-medium">
        New password
        <input name="newPassword" type="password" required minLength={8} autoComplete="new-password" className="field mt-1" />
        <span className="mt-1 block text-xs font-normal text-slate-500">At least 8 characters; avoid common passwords.</span>
      </label>
      <label className="block text-sm font-medium">
        Confirm new password
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="field mt-1" />
      </label>
      <Msg ok={msg?.ok ?? false} text={msg?.text ?? null} />
      <button type="submit" disabled={busy} className="btn btn-primary">
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
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-danger">
        Delete my account…
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-lg bg-red-50 p-4">
      <p className="text-sm text-red-900">
        This removes your name and email and signs you out everywhere. Reports still awaiting review are withdrawn; published reports stay on the public map without your name. This cannot be undone.
      </p>
      <label className="block text-sm font-medium text-red-900">
        Type DELETE to confirm
        <input value={text} onChange={(e) => setText(e.target.value)} className="field mt-1" autoComplete="off" />
      </label>
      <Msg ok={false} text={error} />
      <div className="flex gap-2">
        <button type="button" disabled={busy || text !== "DELETE"} onClick={remove} className="btn btn-danger">
          {busy ? "Deleting…" : "Permanently delete"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}
