"use client";

import { useState } from "react";
import { apiError } from "@/lib/client";

export default function TestEmailButton() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/admin/system/test-email", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: `Sent to ${data.sentTo}.` } : { ok: false, text: apiError(data) });
    } catch {
      setMsg({ ok: false, text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={send} disabled={busy} className="btn btn-secondary !py-1.5">
        {busy ? "Sending…" : "Send test email to me"}
      </button>
      {msg && <span role="status" className={`text-sm ${msg.ok ? "text-ink-700" : "text-red-700"}`}>{msg.text}</span>}
    </div>
  );
}
