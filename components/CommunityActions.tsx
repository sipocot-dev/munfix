"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReportNote } from "@/lib/reports";
import { apiError } from "@/lib/client";
import { formatDateTime } from "@/lib/format";

interface Props {
  id: string;
  signedIn: boolean;
  canReopen: boolean;
  feedback: ReportNote[];
  followups: ReportNote[];
}

export default function CommunityActions({ id, signedIn, canReopen, feedback, followups }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [followupText, setFollowupText] = useState("");

  /** POSTs to the report and refreshes the page. Returns true on success. */
  async function send(key: string, url: string, body?: { text: string }): Promise<boolean> {
    setBusy(key);
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(null);
    if (!res.ok) {
      setError(apiError(await res.json().catch(() => ({}))));
      return false;
    }
    router.refresh();
    return true;
  }

  async function reopen() {
    if (!window.confirm("Reopen this task? It moves back to In progress.")) return;
    await send("reopen", `/api/v1/reports/${id}/reopen`);
  }

  return (
    <section className="card space-y-6 p-5">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Feedback</h2>
        <NoteList notes={feedback} empty="No feedback yet." />
        {signedIn ? (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send("feedback", `/api/v1/reports/${id}/feedback`, { text: feedbackText })) setFeedbackText("");
            }}
          >
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              maxLength={1000}
              rows={3}
              required
              aria-label="Your feedback"
              className="field"
              placeholder="How did the fix go?"
            />
            <button type="submit" disabled={busy !== null} className="btn btn-secondary">
              {busy === "feedback" ? "Sending…" : "Send feedback"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-600">
            <Link href={`/login?next=/reports/${id}`} className="font-semibold text-ink-700 hover:underline">Log in</Link> to leave feedback.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Follow-up requests</h2>
        <NoteList notes={followups} empty="No follow-up requests yet." />
        {signedIn ? (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send("followup", `/api/v1/reports/${id}/followups`, { text: followupText })) setFollowupText("");
            }}
          >
            <textarea
              value={followupText}
              onChange={(e) => setFollowupText(e.target.value)}
              maxLength={1000}
              rows={2}
              required
              aria-label="Follow-up request"
              className="field"
              placeholder="Ask for a visit, for example if the problem is still there."
            />
            <button type="submit" disabled={busy !== null} className="btn btn-secondary">
              {busy === "followup" ? "Sending…" : "Request follow-up"}
            </button>
          </form>
        ) : null}
      </div>

      {canReopen && (
        <button type="button" onClick={reopen} disabled={busy !== null} className="btn btn-secondary">
          {busy === "reopen" ? "Reopening…" : "Reopen task"}
        </button>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}

function NoteList({ notes, empty }: { notes: ReportNote[]; empty: string }) {
  if (notes.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {notes.map((n) => (
        <li key={n.id} className="border-l-2 border-slate-200 pl-3">
          <p className="whitespace-pre-line text-sm text-slate-700">{n.text}</p>
          <p className="text-xs text-slate-500">
            {n.actorName ?? "A resident"} · {formatDateTime(n.createdAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}
