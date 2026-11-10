import { NextResponse } from "next/server";
import { readJson, requireAdmin, route } from "@/lib/api";
import { transitionReport } from "@/lib/reports";
import { transitionSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Move a report through its lifecycle:
 * submitted -> under_review -> verified (published) -> in_progress -> resolved,
 * or rejected / duplicate. Every transition is recorded in the audit log.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const admin = await requireAdmin();
  const { to, note, duplicateOf } = transitionSchema.parse(await readJson(req));
  const result = await transitionReport(id, admin, to, note, duplicateOf);
  return NextResponse.json(result);
});
