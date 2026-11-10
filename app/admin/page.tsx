import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AdminQueue from "@/components/AdminQueue";
import { listAdminReports } from "@/lib/reports";
import { getSession } from "@/lib/session";
import { QUEUE_STATUSES } from "@/lib/status";

export const metadata: Metadata = { title: "Moderation" };

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.role !== "admin") notFound();

  const initial = await listAdminReports([...QUEUE_STATUSES]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Moderation</h1>
      <p className="mt-2 mb-6 text-slate-600">
        Review new reports, publish verified ones, and keep the public timeline up to date. Every action is recorded in the audit log.
      </p>
      <AdminQueue initial={initial} />
    </div>
  );
}
