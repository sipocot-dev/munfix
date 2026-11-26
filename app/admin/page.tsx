import type { Metadata } from "next";
import AdminQueue from "@/components/AdminQueue";
import PageHeader from "@/components/ui/PageHeader";
import { requirePageRole } from "@/lib/guards";
import { queueTabs } from "@/lib/permissions";
import { listAdminReports } from "@/lib/reports";

export const metadata: Metadata = { title: "Work queue" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requirePageRole("/admin", "moderator", "staff", "admin");
  const tabs = queueTabs(session.role);
  const requested = (await searchParams).tab;
  const tab = tabs.find((t) => t.key === requested) ?? tabs[0];
  const initial = await listAdminReports(tab.statuses, session);
  const staff = session.role === "staff";

  return (
    <>
      <PageHeader
        title={staff ? "Work queue" : "Moderation queue"}
        description={
          staff
            ? "Published reports in your categories. Mark work as started and resolved; residents see each step on the public timeline."
            : "Review new reports, publish the ones you verify, and keep the public timeline up to date. Every action is recorded in the audit log."
        }
      />
      <AdminQueue initial={initial} tabs={tabs} initialTab={tab.key} />
    </>
  );
}
