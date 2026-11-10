import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ReportForm from "@/components/ReportForm";
import { MUNICIPALITY } from "@/lib/config";
import { listCategories } from "@/lib/reports";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Report an issue" };

export default async function NewReportPage() {
  if (!(await getSession())) redirect("/login?next=/report/new");
  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Report an issue</h1>
      <p className="mt-2 mb-6 text-slate-600">
        Tell {MUNICIPALITY.name} what needs fixing. Once city staff verify it, it appears on the public map and you can follow its progress.
      </p>
      <ReportForm categories={categories} />
    </div>
  );
}
