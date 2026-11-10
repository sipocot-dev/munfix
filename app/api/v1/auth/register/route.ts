import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { readJson, route } from "@/lib/api";
import { isUniqueViolation, query } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { registerSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  await enforceRateLimit(`register:${clientIp(req)}`, 5, 3600);
  const input = registerSchema.parse(await readJson(req));

  try {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [input.email, input.name, await bcrypt.hash(input.password, 10)],
    );
    await createSession({ userId: user.id, name: input.name, role: "citizen" });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, "An account with this email already exists");
    throw err;
  }
});
