"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiError } from "@/lib/client";
import type { Status } from "@/lib/status";

const ACTION_LABEL: Partial<Record<Status, string>> = {
  under_review: "Start review",
  verified: "Verify & publish",
  in_progress: "Mark in progress",
  resolved: "Mark resolved",
  rejected: "Reject…",
  duplicate: "Mark duplicate…",
};

const PLACEHOLDER: Partial<Record<Status, string>> = {
  verified: "Optional note shown on the public timeline",
  in_progress: "e.g. Crew scheduled for Thursday",
  resolved: "e.g. Pothole filled and road repaved",
  rejected: "Reason (required) — the reporter will see this",
};

/** Moderator actions for one report. Every action is written to the audit log. */
export default function TransitionControls({
  id,
  allowed,
  onDone,
}: {
  id: string;
  allowed: Status[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Status | null>(null);
  const [note, setNote] = useState("");
  const [duplicateOf, setDuplicateOf] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (allowed.length === 0) {
    return <p className="text-sm text-slate-500">No further actions available.</p>;
  }

  function choose(to: Status) {
    setError(null);
    // Actions that need extra input open a small form first.
    if (to === "under_review") void submit(to);
    else setPending(to);
  }

  async function submit(to: Status) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/reports/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          note: note.trim() || undefined,
          duplicateOf: to === "duplicate" ? duplicateOf.trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiError(data));
        return;
      }
      setPending(null);
      setNote("");
      setDuplicateOf("");
      if (onDone) onDone();
      else router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {allowed.map((to) => (
          <button
            key={to}
            type="button"
            disabled={busy}
            onClick={() => choose(to)}
            className={`btn !py-1.5 ${to === "rejected" ? "btn-danger" : pending === to ? "btn-primary" : "btn-secondary"}`}
          >
            {ACTION_LABEL[to] ?? to}
          </button>
        ))}
      </div>

      {pending && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(pending);
          }}
          className="space-y-2 rounded-lg bg-slate-50 p-3"
        >
          {pending === "duplicate" && (
            <input
              value={duplicateOf}
              onChange={(e) => setDuplicateOf(e.target.value)}
              required
              placeholder="ID of the original report (from its URL)"
              className="field"
              aria-label="Original report ID"
            />
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required={pending === "rejected"}
            maxLength={500}
            rows={2}
            placeholder={PLACEHOLDER[pending] ?? "Optional note"}
            className="field"
            aria-label="Note"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary !py-1.5">
              {busy ? "Saving…" : "Confirm"}
            </button>
            <button type="button" onClick={() => setPending(null)} className="btn btn-secondary !py-1.5">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
