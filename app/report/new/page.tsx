import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ReportForm from "@/components/ReportForm";
import { MUNICIPALITY, withinBounds } from "@/lib/config";
import { listCategories, listProblemTypes } from "@/lib/reports";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Report an issue" };

/** Coordinates come from a map click (?lat=&lng=); only accept finite values inside the municipality. */
function fromParams(lat?: string, lng?: string): { lat: number; lng: number } | null {
  const la = Number(lat);
  const ln = Number(lng);
  if (!lat || !lng || !Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return withinBounds(ln, la) ? { lat: la, lng: ln } : null;
}

export default async function NewReportPage({ searchParams }: { searchParams: Promise<{ lat?: string; lng?: string }> }) {
  const { lat, lng } = await searchParams;
  const start = fromParams(lat, lng);
  if (!(await getSession())) {
    const back = start ? `/report/new?lat=${start.lat}&lng=${start.lng}` : "/report/new";
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }
  const [categories, problemTypes] = await Promise.all([listCategories(), listProblemTypes()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Report an issue</h1>
      <p className="mt-2 mb-6 text-slate-600">
        Tell {MUNICIPALITY.name} what needs fixing. Once city staff verify it, it appears on the public map and you can follow its progress.
      </p>
      <ReportForm categories={categories} problemTypes={problemTypes} initialLocation={start} />
    </div>
  );
}
