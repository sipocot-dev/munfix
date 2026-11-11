import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { drainOutbox } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Retries unsent emails and tidies old rows. Called by Vercel Cron (see vercel.json), which sends
 * `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET set the endpoint stays closed.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sent = await drainOutbox();
  await query("DELETE FROM email_outbox WHERE created_at < now() - interval '30 days' AND (sent_at IS NOT NULL OR attempts >= 8)");
  await query("DELETE FROM password_resets WHERE expires_at < now() - interval '7 days'");
  return NextResponse.json({ ok: true, sent });
}
