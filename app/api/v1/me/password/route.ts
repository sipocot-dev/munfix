import { NextResponse } from "next/server";
import { readJson, requireUser, route } from "@/lib/api";
import { changePassword } from "@/lib/accounts";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { passwordChangeSchema } from "@/lib/validation";

/** Also the one route accounts with a temporary password may call. */
export const POST = route(async (req) => {
  const session = await requireUser({ allowPasswordChange: true });
  await enforceRateLimit(`pwchange:${session.userId}`, 10, 900);
  await enforceRateLimit(`pwchange:ip:${clientIp(req)}`, 30, 900);
  const { currentPassword, newPassword } = passwordChangeSchema.parse(await readJson(req));

  const user = await changePassword(session.userId, currentPassword, newPassword);
  // changePassword signed out every device; start a clean session for this one.
  await createSession({ userId: session.userId, name: user.name, role: user.role, mustChangePassword: false });
  return NextResponse.json({ ok: true });
});
