import { NextResponse } from "next/server";
import { requireAdmin, route } from "@/lib/api";
import { query } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { mailEnabled, sendMail } from "@/lib/mail";

/** Sends a test message to the signed-in administrator to verify SMTP settings. */
export const POST = route(async () => {
  const admin = await requireAdmin();
  if (!mailEnabled()) throw new HttpError(409, "Email is not configured. Set SMTP_URL (or SMTP_HOST) and MAIL_FROM.");
  const [u] = await query<{ email: string }>("SELECT email FROM users WHERE id = $1", [admin.userId]);
  try {
    await sendMail({
      to: u.email,
      subject: "[MunFix] Test email",
      text: "If you can read this, MunFix can send email.",
      html: "<p>If you can read this, <strong>MunFix</strong> can send email.</p>",
    });
  } catch (err) {
    throw new HttpError(502, `Sending failed: ${err instanceof Error ? err.message : "unknown error"}`);
  }
  return NextResponse.json({ ok: true, sentTo: u.email });
});
