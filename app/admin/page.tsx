import type { Metadata } from "next";
import AdminQueue from "@/components/AdminQueue";
import PageHeader from "@/components/ui/PageHeader";
import { requirePagePermission } from "@/lib/guards";
import { queueTabs } from "@/lib/permissions";
import { listAdminReports } from "@/lib/reports";

export const metadata: Metadata = { title: "Work queue" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requirePagePermission("/admin", "reports.review", "reports.work");
  const tabs = queueTabs(session.permissions);
  const requested = (await searchParams).tab;
  const tab = tabs.find((t) => t.key === requested) ?? tabs[0];
  const initial = await listAdminReports(tab.statuses, session);
  const staff = !session.permissions.includes("reports.review");

  return (
    <>
      <PageHeader
        title={staff ? "Work queue" : "Moderation queue"}
        description={
          staff
            ? "Published reports in your categories. Mark work as started and resolved; residents see each step on the public timeline."
            : "New reports go public as soon as they are submitted. Check them here: put doubtful ones under review, and hide or reject anything inappropriate. Every action is recorded in the audit log."
        }
      />
      <AdminQueue initial={initial} tabs={tabs} initialTab={tab.key} />
    </>
  );
}
