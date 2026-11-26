import { NextResponse } from "next/server";
import { readJson, requirePermission, route } from "@/lib/api";
import { createRole, listRoles } from "@/lib/roles";
import { newRoleSchema } from "@/lib/validation";

/** Roles and their permissions. User managers need the list to assign roles; only role managers change it. */
export const GET = route(async () => {
  await requirePermission("roles.manage", "users.manage");
  return NextResponse.json({ roles: await listRoles() });
});

export const POST = route(async (req) => {
  const actor = await requirePermission("roles.manage");
  const input = newRoleSchema.parse(await readJson(req));
  return NextResponse.json({ role: await createRole(actor, input) }, { status: 201 });
});
