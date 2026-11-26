"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BARANGAYS } from "@/lib/barangays";
import { apiError } from "@/lib/client";
import { MUNICIPALITY, withinBounds } from "@/lib/config";
import type { Category, ProblemType } from "@/lib/reports";
import LocationPicker, { type LngLat } from "./LocationPicker";
import Alert from "./ui/Alert";
import FormField from "./ui/FormField";
import Icon, { CategoryIcon } from "./ui/Icon";

const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
/** The whole request must stay under the host's ~4.5 MB body limit, or it is refused before reaching the app. */
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

/** Hosting caps a whole request near 4.5 MB, so large photos are scaled down before upload (PDFs go as they are). */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** POST with upload progress (fetch cannot report it). Resolves with status and parsed JSON body. */
function upload(url: string, body: FormData, onProgress: (pct: number) => void): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON error pages (e.g. the host's 413) keep an empty body
      }
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(body);
  });
}

export default function ReportForm({
  categories,
  problemTypes,
  initialLocation = null,
}: {
  categories: Category[];
  problemTypes: ProblemType[];
  initialLocation?: LngLat | null;
}) {
  const router = useRouter();
  const [categorySlug, setCategorySlug] = useState("");
  const [location, setLocation] = useState<LngLat | null>(initialLocation);
  const [files, setFiles] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const types = problemTypes.filter((t) => t.categoryId === categories.find((c) => c.slug === categorySlug)?.id);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const total = files.reduce((n, f) => n + f.size, 0);

  // Move to the error so keyboard and screen-reader users land on it after a failed submit.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (chosen.length === 0) return;
    setPreparing(true);
    // A photo the browser cannot decode (e.g. HEIC on some browsers) goes as it is; the server checks the type.
    const picked = await Promise.all(chosen.map((f) => shrink(f).catch(() => f)));
    setPreparing(false);
    if (picked.some((f) => f.size > MAX_BYTES)) return setError("Each photo must be 5 MB or smaller.");
    const next = [...files, ...picked].slice(0, MAX_FILES);
    if (next.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES) {
      return setError("Your attachments are too large together (4 MB at most). Remove a file or attach a smaller one.");
    }
    setError(files.length + picked.length > MAX_FILES ? `You can attach up to ${MAX_FILES} photos; the extra ones were left out.` : null);
    setFiles(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!location) return setError("Mark where the problem is: click the map, use your location, or pin the map centre.");
    if (!withinBounds(location.lng, location.lat)) return setError(`The pin must be inside ${MUNICIPALITY.name}.`);
    if (files.length === 0) return setError("Attach at least one photo of the problem.");

    const form = new FormData(e.currentTarget);
    form.set("lat", String(location.lat));
    form.set("lng", String(location.lng));
    files.forEach((f) => form.append("photos", f));

    setBusy(true);
    setProgress(0);
    try {
      const { status, data } = await upload("/api/v1/reports", form, setProgress);
      if (status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/report/new?lat=${location.lat}&lng=${location.lng}`)}`);
        return;
      }
      if (status < 200 || status >= 300) {
        setError(status === 413 ? "Your photos are too large to send. Remove one or use smaller photos." : apiError(data));
        return;
      }
      router.push(`/reports/${(data as { id: string }).id}?submitted=1`);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again. Nothing was sent.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" aria-describedby="report-form-intro">
      <Section n={1} title="What is the problem?" description="A short, specific title helps staff find and fix it.">
        <FormField label="Short title" hint="For example: Deep pothole in front of the public market">
          <input name="title" required minLength={5} maxLength={120} className="field" autoComplete="off" />
        </FormField>
        <fieldset>
          <legend className="label">Category</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((c) => (
              <label
                key={c.slug}
                className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-slate-400 has-[:checked]:border-ink-700 has-[:checked]:bg-ink-50 has-[:checked]:text-ink-900 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink-600"
              >
                <input type="radio" name="categorySlug" value={c.slug} required checked={categorySlug === c.slug} onChange={() => setCategorySlug(c.slug)} className="sr-only" />
                <CategoryIcon slug={c.slug} className="h-5 w-5 flex-none text-ink-700" />
                <span className="leading-tight">{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {types.length > 0 && (
          <FormField label="Type of problem">
            <select key={categorySlug} name="problemTypeSlug" required defaultValue="" className="field">
              <option value="" disabled>
                Choose the problem…
              </option>
              {types.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField label="Details" hint="What is wrong, how long has it been like this, and who is affected? Do not include personal information.">
          <textarea name="description" required minLength={10} maxLength={2000} rows={5} className="field" />
        </FormField>
      </Section>

      <Section n={2} title="Where is it?" description="Place the pin as close to the problem as you can.">
        <LocationPicker value={location} onChange={setLocation} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Barangay" optional>
            <input name="barangay" list="barangays" maxLength={80} autoComplete="off" className="field" />
          </FormField>
          <datalist id="barangays">
            {BARANGAYS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          <FormField label="Landmark or street" optional hint="For example: Near the public market">
            <input name="address" maxLength={200} className="field" />
          </FormField>
        </div>
      </Section>

      <Section n={3} title="Photos" description={`At least one, up to ${MAX_FILES}. Clear photos help crews assess the problem. JPEG, PNG, WebP or PDF; large photos are resized for you.`}>
        {files.length > 0 && (
          <ul className="grid grid-cols-3 gap-3 sm:max-w-md">
            {files.map((f, i) => (
              <li key={previews[i]} className="relative">
                {f.type === "application/pdf" ? (
                  <span className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2 text-center text-xs font-medium text-slate-700">
                    <Icon name="file" className="h-6 w-6 text-slate-500" />
                    <span className="line-clamp-2 break-all">{f.name}</span>
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[i]} alt={`Selected photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                )}
                <span className="mt-1 block text-center text-[11px] text-slate-600">{kb(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove ${f.type === "application/pdf" ? f.name : `photo ${i + 1}`}`}
                  className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-white shadow ring-2 ring-white hover:bg-slate-700"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {files.length < MAX_FILES && (
          <div>
            <input
              id="photos"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              onChange={onFiles}
              className="peer sr-only"
              aria-describedby="photos-hint"
            />
            <label
              htmlFor="photos"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition-colors hover:border-ink-400 hover:bg-ink-50/40 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink-600"
            >
              <Icon name="camera" className="h-7 w-7 text-ink-700" />
              <span className="font-semibold text-slate-900">{preparing ? "Preparing photos…" : files.length === 0 ? "Add photos" : "Add another photo"}</span>
              <span id="photos-hint" className="text-sm text-slate-600">
                {files.length} of {MAX_FILES} added{total > 0 && ` · ${kb(total)} of 4 MB`}
              </span>
            </label>
          </div>
        )}
      </Section>

      <div ref={errorRef} tabIndex={-1} className="focus:outline-none">
        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p id="report-form-intro" className="text-sm text-slate-600">
          City staff review every report before it appears on the public map. Your name is never shown publicly.
        </p>
        <button type="submit" disabled={busy || preparing} className="btn btn-accent min-w-44 flex-none">
          {busy ? (progress !== null && progress < 100 ? `Uploading… ${progress}%` : "Saving…") : "Submit report"}
        </button>
      </div>
      {busy && progress !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Upload progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-signal-600 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
    </form>
  );
}

function Section({ n, title, description, children }: { n: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby={`step-${n}`}>
      <div className="mb-5 flex gap-3">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ink-700 text-sm font-bold text-white" aria-hidden>
          {n}
        </span>
        <div>
          <h2 id={`step-${n}`} className="text-lg font-semibold text-slate-900">
            <span className="sr-only">Step {n}: </span>
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
