"use client";

import { useState } from "react";
import { apiError } from "@/lib/client";
import { useToast } from "./ui/Feedback";
import Icon from "./ui/Icon";

/** Email updates on/off. Optimistic: the switch flips at once and rolls back if saving fails. */
export default function NotificationToggle({ initial }: { initial: boolean }) {
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setOn(next);
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
      } else {
        toast(next ? "Email updates are on." : "Email updates are off.");
      }
    } catch {
      setOn(!next);
      setError("Could not save your preference. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
      <div className="flex gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-accent-soft text-accent">
          <Icon name="mail" className="h-5 w-5" />
        </span>
        <div>
          <p id="email-updates-label" className="font-semibold text-fg">
            Email updates
          </p>
          <p className="text-sm text-fg-muted">Get an email when one of your reports changes status.</p>
          {error && (
            <p role="alert" className="mt-1 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="email-updates-label"
        disabled={busy}
        onClick={() => change(!on)}
        className={`relative h-7 w-12 flex-none rounded-full transition-colors disabled:opacity-60 ${on ? "bg-primary" : "bg-line-strong"}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-surface shadow transition-transform ${on ? "translate-x-5" : ""}`} aria-hidden />
      </button>
    </div>
  );
}
