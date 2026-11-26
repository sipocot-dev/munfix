import { NextResponse } from "next/server";
import { readJson, requirePermission, route } from "@/lib/api";
import { createUser, listUsers } from "@/lib/users";
import { newUserSchema } from "@/lib/validation";

export const GET = route(async (req) => {
  await requirePermission("users.manage");
  const sp = req.nextUrl.searchParams;
  const result = await listUsers({
    q: sp.get("q") ?? undefined,
    role: sp.get("role") ?? undefined,
    limit: Number(sp.get("limit")) || 50,
    offset: Number(sp.get("offset")) || 0,
  });
  return NextResponse.json(result);
});

/** Creates an account with a one-time temporary password, returned once in the response. */
export const POST = route(async (req) => {
  const admin = await requirePermission("users.manage");
  const input = newUserSchema.parse(await readJson(req));
  const created = await createUser(admin, input);
  return NextResponse.json(created, { status: 201 });
});
