import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/api";
import { resetPassword } from "@/lib/accounts";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { resetSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  await enforceRateLimit(`reset:ip:${clientIp(req)}`, 20, 900);
  const { token, password } = resetSchema.parse(await readJson(req));
  await resetPassword(token, password);
  return NextResponse.json({ ok: true });
});
