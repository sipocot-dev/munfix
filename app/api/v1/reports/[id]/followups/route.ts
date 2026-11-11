import { NextResponse } from "next/server";
import { readJson, requireUser, route } from "@/lib/api";
import { addActivity } from "@/lib/reports";
import { communitySchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** A follow-up request on a public report. Any signed-in user; logged in the report's history. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const session = await requireUser();
  const { text } = communitySchema.parse(await readJson(req));
  await addActivity(id, session, "followup", text);
  return NextResponse.json({ ok: true });
});
