"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiError, extractId } from "@/lib/client";
import { STATUS_LABEL, type Status } from "@/lib/status";
import Alert from "./ui/Alert";
import { useToast } from "./ui/Feedback";
import FormField from "./ui/FormField";
import Spinner from "./ui/Spinner";

const ACTION_LABEL: Partial<Record<Status, string>> = {
  under_review: "Start review",
  verified: "Verify & publish",
  in_progress: "Mark in progress",
  resolved: "Mark resolved",
  rejected: "Reject…",
  duplicate: "Mark duplicate…",
};

const NOTE_HINT: Partial<Record<Status, string>> = {
  verified: "Optional. Shown on the public timeline.",
  in_progress: "Optional. For example: Crew scheduled for Thursday.",
  resolved: "Optional. For example: Pothole filled and road repaved.",
  rejected: "Required. The reporter sees this reason.",
  duplicate: "Optional note for the reporter.",
};

/** The actions that publish or move work forward get the strong style; rejecting gets the danger style. */
function buttonClass(to: Status, pending: Status | null): string {
  if (to === "rejected") return "btn-danger";
  if (pending === to || to === "verified" || to === "resolved") return "btn-primary";
  return "btn-secondary";
}

/** Moderator and field-staff actions for one report. Every action is written to the audit log. */
export default function TransitionControls({
  id,
  allowed,
  onDone,
}: {
  id: string;
  allowed: Status[];
  /** Called with the new status after the server accepted the change. */
  onDone?: (to: Status) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<Status | null>(null);
  const [note, setNote] = useState("");
  const [duplicateOf, setDuplicateOf] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (allowed.length === 0) {
    return <p className="text-sm text-slate-600">No further actions for your role at this stage.</p>;
  }

  function choose(to: Status) {
    setError(null);
    // Starting a review needs nothing else; every other action opens a short form first.
    if (to === "under_review") void submit(to);
    else setPending(pending === to ? null : to);
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
          duplicateOf: to === "duplicate" ? extractId(duplicateOf) : undefined,
        }),
      });
      if (!res.ok) return setError(apiError(await res.json().catch(() => ({}))));
      setPending(null);
      setNote("");
      setDuplicateOf("");
      toast(`Moved to ${STATUS_LABEL[to]}.`);
      if (onDone) onDone(to);
      else router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was changed.");
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
            aria-expanded={to === "under_review" ? undefined : pending === to}
            onClick={() => choose(to)}
            className={`btn btn-sm ${buttonClass(to, pending)}`}
          >
            {busy && to === "under_review" && <Spinner />}
            {ACTION_LABEL[to] ?? STATUS_LABEL[to]}
          </button>
        ))}
      </div>

      {pending && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(pending);
          }}
          className="animate-fade-up space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5"
          aria-label={ACTION_LABEL[pending]?.replace("…", "")}
        >
          {pending === "duplicate" && (
            <FormField label="Original report" hint="Paste the original report's link or ID (from its address bar).">
              <input value={duplicateOf} onChange={(e) => setDuplicateOf(e.target.value)} required className="field" autoComplete="off" spellCheck={false} />
            </FormField>
          )}
          <FormField label={pending === "rejected" ? "Reason" : "Note"} hint={NOTE_HINT[pending]}>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} required={pending === "rejected"} maxLength={500} rows={2} className="field" />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={`btn btn-sm ${pending === "rejected" ? "btn-danger-solid" : "btn-primary"}`}>
              {busy && <Spinner />}
              {busy ? "Saving…" : `Confirm: ${STATUS_LABEL[pending]}`}
            </button>
            <button type="button" onClick={() => setPending(null)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
