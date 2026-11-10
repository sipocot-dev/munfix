import { NextResponse } from "next/server";
import { readJson, requireUser, route } from "@/lib/api";
import { updateProfile } from "@/lib/accounts";
import { createSession, revokeUserSessions } from "@/lib/session";
import { profileSchema } from "@/lib/validation";

export const PATCH = route(async (req) => {
  const session = await requireUser();
  const { name } = profileSchema.parse(await readJson(req));
  await updateProfile(session.userId, name);
  // The session caches the display name; swap it for a fresh one.
  await revokeUserSessions(session.userId);
  await createSession({ ...session, name });
  return NextResponse.json({ ok: true, name });
});
