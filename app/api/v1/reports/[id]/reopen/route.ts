import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/api";
import { transitionReport } from "@/lib/reports";

type Ctx = { params: Promise<{ id: string }> };

/** Reopen a resolved report (back to in progress). The reporter or staff; logged in the report's history. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const session = await requireUser();
  const result = await transitionReport(id, session, "in_progress", undefined, undefined);
  return NextResponse.json(result);
});
