import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/api";
import { query } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { hasWorkspace, type Role } from "@/lib/permissions";
import { isLocalEnvironment } from "@/lib/env";
import { isDemoAccount } from "@/lib/setup";
import { resolveRole } from "@/lib/roles";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

// Compared when the email is unknown so response time doesn't reveal which emails are registered.
// Made with hashPassword so its bcrypt cost always matches real hashes (a fixed cost-10 hash answered ~30 ms faster).
let dummyHash: Promise<string> | undefined;

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

  const ok = await verifyPassword(input.password, user?.password_hash ?? (await (dummyHash ??= hashPassword("munfix-dummy-password"))));
  if (!user || !user.password_hash || !ok) throw new HttpError(401, "Incorrect email or password");
  // Only said after the password is right, so it does not reveal which emails exist.
  if (!user.is_active) throw new HttpError(403, "This account has been deactivated. Please contact the city administrator.");
  // Test accounts have published passwords, so they only work on a local or test deployment.
  if (isDemoAccount(input.email) && !isLocalEnvironment()) throw new HttpError(401, "Incorrect email or password");

  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
  await createSession({ userId: user.id, name: user.name, role: user.role, mustChangePassword: user.must_change_password });
  const role = await resolveRole(user.role);
  return NextResponse.json({
    ok: true,
    role: user.role,
    workspace: !user.must_change_password && role.isActive && hasWorkspace(role.permissions),
    mustChangePassword: user.must_change_password,
  });
});
