import { NextResponse } from "next/server";
import { readJson, requireStaff, route } from "@/lib/api";
import { transitionReport } from "@/lib/reports";
import { transitionSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Move a report through its lifecycle (what each role may do is in lib/permissions.ts):
 * submitted -> under_review -> verified (published) -> in_progress -> resolved,
 * or rejected / duplicate. Every transition is recorded in the audit log.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireStaff();
  const { to, note, duplicateOf } = transitionSchema.parse(await readJson(req));
  const result = await transitionReport(id, actor, to, note, duplicateOf);
  return NextResponse.json(result);
});
