"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiError } from "@/lib/client";

export default function WithdrawButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    if (!window.confirm("Withdraw this report? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/v1/reports/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      setError(apiError(await res.json().catch(() => ({}))));
    }
    setBusy(false);
  }

  return (
    <div>
      <button onClick={withdraw} disabled={busy} className="btn btn-danger">
        {busy ? "Withdrawing…" : "Withdraw report"}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
