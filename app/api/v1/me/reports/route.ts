import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/api";
import { listUserReports } from "@/lib/reports";

export const GET = route(async () => {
  const session = await requireUser();
  return NextResponse.json({ reports: await listUserReports(session.userId) });
});
