import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/api";
import { requestPasswordReset } from "@/lib/accounts";
import { mailEnabled } from "@/lib/mail";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { forgotSchema } from "@/lib/validation";

/** Always answers the same way, so it cannot be used to discover which emails are registered. */
export const POST = route(async (req) => {
  const { email } = forgotSchema.parse(await readJson(req));
  await enforceRateLimit(`forgot:ip:${clientIp(req)}`, 10, 3600);
  await enforceRateLimit(`forgot:email:${email}`, 3, 3600);
  if (mailEnabled()) await requestPasswordReset(email);
  return NextResponse.json({ ok: true, emailEnabled: mailEnabled() });
});
