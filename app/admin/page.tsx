import type { Metadata } from "next";
import AdminNav from "@/components/AdminNav";
import AdminQueue from "@/components/AdminQueue";
import { requirePageRole } from "@/lib/guards";
import { defaultTab, queueTabs } from "@/lib/permissions";
import { listAdminReports } from "@/lib/reports";

export const metadata: Metadata = { title: "Work queue" };

export default async function AdminPage() {
  const session = await requirePageRole("/admin", "moderator", "staff", "admin");
  const initial = await listAdminReports(defaultTab(session.role).statuses, session);
  const staff = session.role === "staff";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">{staff ? "Work queue" : "Moderation"}</h1>
      <p className="mt-2 mb-4 text-slate-600">
        {staff
          ? "Published reports assigned to your categories. Mark work as started and resolved; every action is recorded."
          : "Review new reports, publish verified ones, and keep the public timeline up to date. Every action is recorded in the audit log."}
      </p>
      <AdminNav role={session.role} current="/admin" />
      <AdminQueue initial={initial} tabs={queueTabs(session.role)} />
    </div>
  );
}
