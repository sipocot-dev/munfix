import { NextResponse } from "next/server";
import { requireStaff, route } from "@/lib/api";
import { defaultTab } from "@/lib/permissions";
import { listAdminReports } from "@/lib/reports";
import { isStatus, type Status } from "@/lib/status";

/** Work queue for moderators, field staff and admins. What comes back depends on the caller's role. */
export const GET = route(async (req) => {
  const session = await requireStaff();
  const requested = (req.nextUrl.searchParams.get("status") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(isStatus) as Status[];
  const statuses = requested.length > 0 ? requested : defaultTab(session.role).statuses;
  return NextResponse.json({ reports: await listAdminReports(statuses, session) });
});
