import { NextResponse } from "next/server";
import { readJson, requireAdmin, route } from "@/lib/api";
import { updateUser } from "@/lib/users";
import { userPatchSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Change a user's role, active state, name, category scope, or reset their password. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const patch = userPatchSchema.parse(await readJson(req));
  const result = await updateUser(admin, id, patch);
  return NextResponse.json({ ok: true, ...result });
});
