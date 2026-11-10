import { NextResponse } from "next/server";
import { readJson, requireUser, route } from "@/lib/api";
import { deleteAccount } from "@/lib/accounts";
import { destroySession } from "@/lib/session";
import { deleteAccountSchema } from "@/lib/validation";

/** Deletes (anonymises) the signed-in user's own account. Body must be {"confirm":"DELETE"}. */
export const DELETE = route(async (req) => {
  const session = await requireUser({ allowPasswordChange: true });
  deleteAccountSchema.parse(await readJson(req));
  await deleteAccount(session.userId);
  await destroySession();
  return NextResponse.json({ ok: true });
});
