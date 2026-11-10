import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { readJson, route } from "@/lib/api";
import { query } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

// A real bcrypt hash of a random string, compared when the email is unknown so
// that response time doesn't reveal which emails are registered.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8nF6Y2QJ9f3vQhJw0QvB0cH1x1uYKe";

export const POST = route(async (req) => {
  const input = loginSchema.parse(await readJson(req));
  await enforceRateLimit(`login:ip:${clientIp(req)}`, 20, 900);
  await enforceRateLimit(`login:email:${input.email}`, 8, 900);

  const [user] = await query<{ id: string; name: string; role: "citizen" | "admin"; password_hash: string | null }>(
    "SELECT id, name, role, password_hash FROM users WHERE lower(email) = $1",
    [input.email],
  );
  const ok = await bcrypt.compare(input.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "Incorrect email or password");

  await createSession({ userId: user.id, name: user.name, role: user.role });
  return NextResponse.json({ ok: true, role: user.role });
});
