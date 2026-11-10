import { NextResponse } from "next/server";
import { requireAdmin, route } from "@/lib/api";
import { listAuditLogs } from "@/lib/reports";

export const GET = route(async (req) => {
  await requireAdmin();
  const sp = req.nextUrl.searchParams;
  const logs = await listAuditLogs(Number(sp.get("limit")) || 100, Number(sp.get("offset")) || 0);
  return NextResponse.json({ logs });
});
