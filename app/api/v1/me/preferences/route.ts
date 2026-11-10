import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, requireUser, route } from "@/lib/api";
import { query } from "@/lib/db";
import { mailEnabled } from "@/lib/mail";

const schema = z.object({ emailNotifications: z.boolean() });

export const GET = route(async () => {
  const session = await requireUser();
  const [row] = await query<{ email_notifications: boolean }>("SELECT email_notifications FROM users WHERE id = $1", [session.userId]);
  return NextResponse.json({ emailNotifications: row?.email_notifications ?? true, emailAvailable: mailEnabled() });
});

export const PATCH = route(async (req) => {
  const session = await requireUser();
  const { emailNotifications } = schema.parse(await readJson(req));
  await query("UPDATE users SET email_notifications = $2 WHERE id = $1", [session.userId, emailNotifications]);
  return NextResponse.json({ emailNotifications });
});
