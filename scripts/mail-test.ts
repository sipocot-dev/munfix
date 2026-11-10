// Sends one test email to verify your SMTP settings: npm run mail:test -- you@example.com
import { mailEnabled, mailFrom, sendMail } from "../lib/mail";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: npm run mail:test -- you@example.com");
    process.exit(1);
  }
  if (!mailEnabled()) {
    console.error("Email is not configured. Set SMTP_URL (or SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) and MAIL_FROM.");
    process.exit(1);
  }
  console.log(`Sending from ${mailFrom()} to ${to}…`);
  await sendMail({
    to,
    subject: "[MunFix] Test email",
    text: "If you can read this, MunFix can send email.",
    html: "<p>If you can read this, <strong>MunFix</strong> can send email.</p>",
  });
  console.log("Sent.");
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
