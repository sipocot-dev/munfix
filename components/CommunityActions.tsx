"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReportNote } from "@/lib/reports";
import { apiError } from "@/lib/client";
import { formatDateTime } from "@/lib/format";
import Alert from "./ui/Alert";
import { useConfirm, useToast } from "./ui/Feedback";
import Icon from "./ui/Icon";
import Spinner from "./ui/Spinner";

interface Props {
  id: string;
  signedIn: boolean;
  canReopen: boolean;
  feedback: ReportNote[];
  followups: ReportNote[];
}

/** Feedback and follow-up requests from residents, kept in the report's public history. */
export default function CommunityActions({ id, signedIn, canReopen, feedback, followups }: Props) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** POSTs to the report and refreshes the page. Returns true on success. */
  async function send(key: string, url: string, body?: { text: string }): Promise<boolean> {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        setError(apiError(await res.json().catch(() => ({}))));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function reopen() {
    const ok = await confirm({
      title: "Reopen this report?",
      body: "It moves back to In progress so city staff take another look. Use this when the problem is not actually fixed.",
      confirmLabel: "Reopen",
    });
    if (ok && (await send("reopen", `/api/v1/reports/${id}/reopen`))) toast("The report is back in progress.");
  }

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="community-title">
      <h2 id="community-title" className="text-lg font-semibold">
        Community
      </h2>
      <p className="mt-1 text-sm text-fg-muted">Tell city staff how the fix went, or ask for another visit. Entries are public; your name is not shown.</p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <NoteThread
          title="Feedback"
          notes={feedback}
          empty="No feedback yet."
          signedIn={signedIn}
          busy={busy}
          id={id}
          kind="feedback"
          placeholder="How did the fix go?"
          submitLabel="Send feedback"
          onSend={async (text) => (await send("feedback", `/api/v1/reports/${id}/feedback`, { text })) && (toast("Thanks, your feedback was added."), true)}
        />
        <NoteThread
          title="Follow-up requests"
          notes={followups}
          empty="No follow-up requests yet."
          signedIn={signedIn}
          busy={busy}
          id={id}
          kind="followup"
          placeholder="For example: the problem is still there."
          submitLabel="Request follow-up"
          onSend={async (text) => (await send("followup", `/api/v1/reports/${id}/followups`, { text })) && (toast("Your follow-up request was added."), true)}
        />
      </div>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}

      {canReopen && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <p className="text-sm text-fg-muted">Not actually fixed?</p>
          <button type="button" onClick={reopen} disabled={busy !== null} className="btn btn-secondary btn-sm">
            {busy === "reopen" ? <Spinner /> : <Icon name="refresh" className="h-4 w-4" />}
            {busy === "reopen" ? "Reopening…" : "Reopen report"}
          </button>
        </div>
      )}
    </section>
  );
}

function NoteThread({
  title,
  notes,
  empty,
  signedIn,
  busy,
  id,
  kind,
  placeholder,
  submitLabel,
  onSend,
}: {
  title: string;
  notes: ReportNote[];
  empty: string;
  signedIn: boolean;
  busy: string | null;
  id: string;
  kind: string;
  placeholder: string;
  submitLabel: string;
  onSend: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const fieldId = `${kind}-text`;
  return (
    <div className="flex min-w-0 flex-col">
      <h3 className="flex items-center gap-2 font-semibold text-fg">
        <Icon name="message" className="h-4.5 w-4.5 text-fg-muted" />
        {title}
        <span className="rounded-full bg-surface-3 px-2 text-xs font-semibold text-fg-muted">{notes.length}</span>
      </h3>
      {notes.length === 0 ? (
        <p className="mt-2 text-sm text-fg-muted">{empty}</p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-surface-2 px-3 py-2.5">
              <p className="whitespace-pre-line break-words text-sm text-fg">{n.text}</p>
              <p className="mt-1 text-xs text-fg-muted">
                {n.actorName ?? "A resident"} · <time dateTime={n.createdAt}>{formatDateTime(n.createdAt)}</time>
              </p>
            </li>
          ))}
        </ul>
      )}
      {signedIn ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onSend(text)) setText("");
          }}
        >
          <label htmlFor={fieldId} className="sr-only">
            {title}
          </label>
          <textarea id={fieldId} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={2} required className="field" placeholder={placeholder} />
          <button type="submit" disabled={busy !== null || !text.trim()} className="btn btn-secondary btn-sm">
            {busy === kind && <Spinner />}
            {busy === kind ? "Sending…" : submitLabel}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-fg-muted">
          <Link href={`/login?next=/reports/${id}`} className="link">
            Log in
          </Link>{" "}
          to add yours.
        </p>
      )}
    </div>
  );
}
