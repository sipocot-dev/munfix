"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiError } from "@/lib/client";
import Alert from "./ui/Alert";
import { useConfirm, useToast } from "./ui/Feedback";
import Spinner from "./ui/Spinner";

export default function WithdrawButton({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    const ok = await confirm({
      title: "Withdraw this report?",
      body: "City staff will stop reviewing it and it will never be published. This cannot be undone.",
      confirmLabel: "Withdraw report",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/reports/${id}`, { method: "DELETE" });
      if (!res.ok) return setError(apiError(await res.json().catch(() => ({}))));
      toast("Your report was withdrawn.");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={withdraw} disabled={busy} className="btn btn-danger btn-sm">
        {busy && <Spinner />}
        {busy ? "Withdrawing…" : "Withdraw report"}
      </button>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
