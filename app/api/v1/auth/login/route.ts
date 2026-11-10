import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/api";
import { query } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { verifyPassword } from "@/lib/passwords";
import type { Role } from "@/lib/permissions";
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

  const [user] = await query<{
    id: string;
    name: string;
    role: Role;
    password_hash: string | null;
    is_active: boolean;
    must_change_password: boolean;
  }>("SELECT id, name, role, password_hash, is_active, must_change_password FROM users WHERE lower(email) = $1", [input.email]);

  const ok = await verifyPassword(input.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.password_hash || !ok) throw new HttpError(401, "Incorrect email or password");
  // Only said after the password is right, so it does not reveal which emails exist.
  if (!user.is_active) throw new HttpError(403, "This account has been deactivated. Please contact the city administrator.");

  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
  await createSession({ userId: user.id, name: user.name, role: user.role, mustChangePassword: user.must_change_password });
  return NextResponse.json({ ok: true, role: user.role, mustChangePassword: user.must_change_password });
});
