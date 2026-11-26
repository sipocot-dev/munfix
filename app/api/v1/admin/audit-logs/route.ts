import { NextResponse } from "next/server";
import { requirePermission, route } from "@/lib/api";
import { listAuditLogs } from "@/lib/reports";

export const GET = route(async (req) => {
  await requirePermission("audit.view");
  const sp = req.nextUrl.searchParams;
  const logs = await listAuditLogs(Number(sp.get("limit")) || 100, Number(sp.get("offset")) || 0);
  return NextResponse.json({ logs });
});
