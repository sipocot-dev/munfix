import { NextResponse } from "next/server";
import { requireAdmin, route } from "@/lib/api";
import { listAdminReports } from "@/lib/reports";
import { QUEUE_STATUSES, isStatus, type Status } from "@/lib/status";

/** Moderation queue. Defaults to submitted + under_review. */
export const GET = route(async (req) => {
  await requireAdmin();
  const requested = (req.nextUrl.searchParams.get("status") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(isStatus) as Status[];
  const reports = await listAdminReports(requested.length > 0 ? requested : [...QUEUE_STATUSES]);
  return NextResponse.json({ reports });
});
