"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BARANGAYS } from "@/lib/barangays";
import { apiError } from "@/lib/client";
import Alert from "./ui/Alert";
import { useToast } from "./ui/Feedback";
import FormField from "./ui/FormField";
import Icon from "./ui/Icon";
import Spinner from "./ui/Spinner";

interface Values {
  title: string;
  description: string;
  address: string;
  barangay: string;
}

/**
 * Lets the reporter correct their report until a moderator picks it up (PATCH /api/v1/reports/:id,
 * which the server allows only while the status is "submitted"). Category and location are not editable here.
 */
export default function EditReportForm({ id, initial }: { id: string; initial: Values }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const changed: Partial<Values> = {};
    for (const key of ["title", "description", "address", "barangay"] as const) {
      const v = String(f.get(key) ?? "").trim();
      if (v !== initial[key]) changed[key] = v;
    }
    if (Object.keys(changed).length === 0) return setOpen(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changed),
      });
      if (!res.ok) return setError(apiError(await res.json().catch(() => ({}))));
      setOpen(false);
      toast("Your report was updated.");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div>
        <p className="mb-3 text-sm text-slate-600">Spotted a mistake? You can edit the text until a moderator starts the review.</p>
        <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary btn-sm">
          <Icon name="edit" className="h-4 w-4" />
          Edit report
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Title">
        <input name="title" defaultValue={initial.title} required minLength={5} maxLength={120} className="field" />
      </FormField>
      <FormField label="Details">
        <textarea name="description" defaultValue={initial.description} required minLength={10} maxLength={2000} rows={5} className="field" />
      </FormField>
      <FormField label="Barangay" optional>
        <input name="barangay" defaultValue={initial.barangay} list="edit-barangays" maxLength={80} autoComplete="off" className="field" />
      </FormField>
      <datalist id="edit-barangays">
        {BARANGAYS.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <FormField label="Landmark or street" optional>
        <input name="address" defaultValue={initial.address} maxLength={200} className="field" />
      </FormField>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          {busy && <Spinner />}
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
