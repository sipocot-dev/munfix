"use client";

import { useState } from "react";
import { apiError } from "@/lib/client";

export default function NotificationToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setOn(next); // optimistic
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifications: next }),
      });
      if (!res.ok) {
        setOn(!next);
        setError(apiError(await res.json().catch(() => ({}))));
      }
    } catch {
      setOn(!next);
      setError("Could not save your preference.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="font-semibold">Email updates</p>
        <p className="text-sm text-slate-600">Get an email when the status of one of your reports changes.</p>
        {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={(e) => change(e.target.checked)}
          className="peer sr-only"
          aria-label="Email updates"
        />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-teal-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-600 peer-disabled:opacity-60" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </label>
    </div>
  );
}
