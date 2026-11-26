import { NextResponse } from "next/server";
import { readJson, requirePermission, route } from "@/lib/api";
import { updateRole } from "@/lib/roles";
import { rolePatchSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ key: string }> };

/** Rename, describe, change permissions of, enable or disable a custom role. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const actor = await requirePermission("roles.manage");
  const { key } = await params;
  const patch = rolePatchSchema.parse(await readJson(req));
  return NextResponse.json({ role: await updateRole(actor, key, patch) });
});
