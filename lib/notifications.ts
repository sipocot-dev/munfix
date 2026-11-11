import { after } from "next/server";
import type { PoolClient } from "pg";
import { query, withTx } from "./db";
import { statusEmail } from "./email-templates";
import { mailEnabled, sendMail } from "./mail";
import type { Status } from "./status";

const MAX_ATTEMPTS = 8;
const BATCH = 20;

/**
 * Queue an email to the reporter. Call this inside the same transaction as the
 * status change so the notification and the change commit (or roll back) together.
 * A no-op when email is not configured or the reporter opted out.
 */
export async function queueStatusEmail(
  client: PoolClient,
  reportId: string,
  from: Status | null,
  to: Status,
  note: string | null,
): Promise<void> {
  if (!mailEnabled()) return;

  const { rows } = await client.query<{
    user_id: string;
    email: string;
    name: string;
    email_notifications: boolean;
    title: string;
    duplicate_of: string | null;
  }>(
    `SELECT u.id AS user_id, u.email, u.name, u.email_notifications, r.title, r.duplicate_of
       FROM reports r JOIN users u ON u.id = r.user_id
      WHERE r.id = $1`,
    [reportId],
  );
  const row = rows[0];
  if (!row || !row.email_notifications) return;

  const mail = statusEmail({
    name: row.name,
    title: row.title,
    reportId,
    from,
    to,
    note,
    duplicateOf: row.duplicate_of,
  });
  if (!mail) return;

  await client.query(
    `INSERT INTO email_outbox (user_id, report_id, to_email, subject, text_body, html_body)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [row.user_id, reportId, row.email, mail.subject, mail.text, mail.html],
  );
}

/** Queue a one-off transactional email (e.g. password reset). Returns false when email is not configured. */
export async function enqueueMail(
  userId: string | null,
  to: string,
  mail: { subject: string; text: string; html: string },
): Promise<boolean> {
  if (!mailEnabled()) return false;
  await query(
    `INSERT INTO email_outbox (user_id, to_email, subject, text_body, html_body) VALUES ($1, $2, $3, $4, $5)`,
    [userId, to, mail.subject, mail.text, mail.html],
  );
  triggerDrain();
  return true;
}

let draining = false;
let rerun = false;

/**
 * Sends pending emails. Rows are claimed with FOR UPDATE SKIP LOCKED, so several
 * app instances can run this safely. A failed send is retried with exponential
 * backoff (2, 4, 8 … up to 60 minutes) and abandoned after MAX_ATTEMPTS.
 */
export async function drainOutbox(): Promise<number> {
  if (!mailEnabled()) return 0;
  // A drain is already running: ask it to look again once it finishes, so mail queued
  // mid-drain goes out right away instead of waiting for the next worker tick.
  if (draining) {
    rerun = true;
    return 0;
  }
  draining = true;
  let sent = 0;
  try {
    do {
      rerun = false;
      sent += await drainBatches();
    } while (rerun);
  } finally {
    draining = false;
  }
  return sent;
}

async function drainBatches(): Promise<number> {
  let sent = 0;
  for (;;) {
    const finished = await withTx(async (client) => {
      const { rows } = await client.query<{
        id: string;
        to_email: string;
        subject: string;
        text_body: string;
        html_body: string;
      }>(
        `SELECT id, to_email, subject, text_body, html_body
           FROM email_outbox
          WHERE sent_at IS NULL AND attempts < $1 AND next_attempt_at <= now()
          ORDER BY id
          LIMIT $2
            FOR UPDATE SKIP LOCKED`,
        [MAX_ATTEMPTS, BATCH],
      );
      for (const r of rows) {
        try {
          await sendMail({ to: r.to_email, subject: r.subject, text: r.text_body, html: r.html_body });
          await client.query(`UPDATE email_outbox SET sent_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1`, [r.id]);
          sent++;
        } catch (err) {
          const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
          await client.query(
            `UPDATE email_outbox
                SET attempts = attempts + 1,
                    last_error = $2,
                    next_attempt_at = now() + least(power(2, attempts + 1), 60) * interval '1 minute'
              WHERE id = $1`,
            [r.id, message],
          );
          console.warn(`[mail] send to outbox #${r.id} failed: ${message}`);
        }
      }
      return rows.length < BATCH;
    });
    if (finished) break;
  }
  return sent;
}

/** Fire-and-forget: try to send right after a change commits, without delaying the response. */
export function triggerDrain(): void {
  if (!mailEnabled()) return;
  const run = () => drainOutbox().catch((err) => console.error("[mail] drain failed:", err));
  // On serverless hosts the instance freezes once the response is sent, so ask the
  // framework to keep it alive until the drain finishes.
  try {
    after(run);
  } catch {
    void run();
  }
}

/** Background loop for retries and housekeeping. Started once from instrumentation.ts. */
export function startMailWorker(): void {
  const g = globalThis as unknown as { __mailWorker?: boolean };
  if (g.__mailWorker || !mailEnabled()) return;
  g.__mailWorker = true;

  const tick = () => drainOutbox().catch((err) => console.error("[mail] worker failed:", err));
  setInterval(tick, 60_000).unref();
  setTimeout(tick, 5_000).unref();

  // Keep the table small: drop old sent rows and long-abandoned failures.
  const cleanup = () =>
    query(
      `DELETE FROM email_outbox
        WHERE created_at < now() - interval '30 days' AND (sent_at IS NOT NULL OR attempts >= $1)`,
      [MAX_ATTEMPTS],
    ).catch(() => {});
  setInterval(cleanup, 6 * 60 * 60 * 1000).unref();
  console.log("[mail] notification worker started");
}
