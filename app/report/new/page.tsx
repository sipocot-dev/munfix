import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ReportForm from "@/components/ReportForm";
import PageHeader from "@/components/ui/PageHeader";
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
    <div className="container-page container-narrow">
      <PageHeader
        back={{ href: "/", label: "Back to the map" }}
        title="Report an issue"
        description={`Tell ${MUNICIPALITY.name} what needs fixing. Your report goes on the public map as soon as you submit it, and you can follow it until it is fixed.`}
      />
      <ReportForm categories={categories} problemTypes={problemTypes} initialLocation={start} />
    </div>
  );
}
