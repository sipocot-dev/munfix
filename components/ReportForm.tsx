"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BARANGAYS } from "@/lib/barangays";
import { apiError } from "@/lib/client";
import { MUNICIPALITY, withinBounds } from "@/lib/config";
import type { Category, ProblemType } from "@/lib/reports";
import LocationPicker, { type LngLat } from "./LocationPicker";

const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;

export default function ReportForm({
  categories,
  problemTypes,
  initialLocation = null,
}: {
  categories: Category[];
  problemTypes: ProblemType[];
  initialLocation?: LngLat | null;
}) {
  const [categorySlug, setCategorySlug] = useState("");
  const router = useRouter();
  const [location, setLocation] = useState<LngLat | null>(initialLocation);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const types = problemTypes.filter((t) => t.categoryId === categories.find((c) => c.slug === categorySlug)?.id);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const next = [...files, ...picked].slice(0, MAX_FILES);
    if (files.length + picked.length > MAX_FILES) setError(`You can attach up to ${MAX_FILES} photos.`);
    else if (picked.some((f) => f.size > MAX_BYTES)) {
      setError("Each photo must be 5 MB or smaller.");
      return;
    } else setError(null);
    setFiles(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!location) return setError("Click the map to mark where the problem is.");
    if (!withinBounds(location.lng, location.lat)) return setError(`The pin must be inside ${MUNICIPALITY.name}.`);

    const form = new FormData(e.currentTarget);
    form.set("lat", String(location.lat));
    form.set("lng", String(location.lng));
    files.forEach((f) => form.append("photos", f));

    setBusy(true);
    try {
      const res = await fetch("/api/v1/reports", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        const back = location ? `/report/new?lat=${location.lat}&lng=${location.lng}` : "/report/new";
        router.push(`/login?next=${encodeURIComponent(back)}`);
        return;
      }
      if (!res.ok) {
        setError(apiError(data));
        return;
      }
      router.push(`/reports/${data.id}`);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-semibold">What is the problem?</h2>
        <label className="block text-sm font-medium">
          Short title
          <input
            name="title"
            required
            minLength={5}
            maxLength={120}
            placeholder="e.g. Deep pothole in front of the public market"
            className="field mt-1"
          />
        </label>
        <label className="block text-sm font-medium">
          Category
          <select name="categorySlug" required value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} className="field mt-1">
            <option value="" disabled>
              Choose a category…
            </option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {types.length > 0 && (
          <label className="block text-sm font-medium">
            Type of problem
            <select key={categorySlug} name="problemTypeSlug" required defaultValue="" className="field mt-1">
              <option value="" disabled>
                Choose the problem…
              </option>
              {types.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm font-medium">
          Details
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            placeholder="What is wrong, how long has it been like this, and why does it matter?"
            className="field mt-1"
          />
        </label>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-semibold">Where is it?</h2>
        <LocationPicker value={location} onChange={setLocation} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Barangay <span className="font-normal text-slate-500">(optional)</span>
            <input name="barangay" list="barangays" maxLength={80} autoComplete="off" className="field mt-1" />
            <datalist id="barangays">
              {BARANGAYS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </label>
          <label className="block text-sm font-medium">
            Landmark or street <span className="font-normal text-slate-500">(optional)</span>
            <input name="address" maxLength={200} placeholder="e.g. Near the public market" className="field mt-1" />
          </label>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-semibold">
          Photos <span className="text-sm font-normal text-slate-500">(optional, up to {MAX_FILES})</span>
        </h2>
        <p className="text-sm text-slate-600">Clear photos help city crews find and assess the problem. JPEG, PNG or WebP, up to 5 MB each.</p>
        {previews.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <li key={src} className="relative">
                {files[i].type === "application/pdf" ? (
                  <span className="grid h-24 w-24 place-items-center break-all rounded-lg bg-slate-100 p-2 text-center text-xs font-semibold">{files[i].name}</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={`Selected photo ${i + 1}`} className="h-24 w-24 rounded-lg object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-xs text-white"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {files.length < MAX_FILES && (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            onChange={onFiles}
            className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold hover:file:bg-slate-200"
          />
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Submitting…" : "Submit report"}
        </button>
        <p className="text-sm text-slate-500">City staff review every report before it appears on the public map.</p>
      </div>
    </form>
  );
}
