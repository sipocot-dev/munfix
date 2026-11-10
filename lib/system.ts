import { query } from "./db";
import { mailEnabled } from "./mail";
import { PROVIDERS, isConfigured, redirectUri, type Provider } from "./oauth";
import { redis } from "./redis";

export interface SystemStatus {
  database: { ok: boolean; detail: string };
  redis: { ok: boolean; detail: string };
  mail: { enabled: boolean; pending: number; failed: number };
  storage: { driver: string; detail: string };
  appUrl: string;
  providers: { id: Provider; configured: boolean; redirectUri: string }[];
  adminsWithTempPassword: number;
  demoAccounts: number;
}

async function probe(fn: () => Promise<unknown>): Promise<{ ok: boolean; detail: string }> {
  const t = Date.now();
  try {
    await fn();
    return { ok: true, detail: `OK (${Date.now() - t} ms)` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "unreachable" };
  }
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const [database, redisStatus] = await Promise.all([probe(() => query("SELECT 1")), probe(() => redis.ping())]);
  let pending = 0;
  let failed = 0;
  let temp = 0;
  let demo = 0;
  if (database.ok) {
    try {
      const [m] = await query<{ pending: string; failed: string }>(
        `SELECT count(*) FILTER (WHERE sent_at IS NULL AND attempts < 8) AS pending, count(*) FILTER (WHERE sent_at IS NULL AND attempts >= 8) AS failed FROM email_outbox`,
      );
      pending = Number(m?.pending ?? 0);
      failed = Number(m?.failed ?? 0);
    } catch {
      /* outbox columns differ or table missing: leave zero */
    }
    const [u] = await query<{ temp: string; demo: string }>(
      `SELECT count(*) FILTER (WHERE role = 'admin' AND must_change_password AND is_active) AS temp,
              count(*) FILTER (WHERE email LIKE '%@munfix.local') AS demo FROM users WHERE deleted_at IS NULL`,
    );
    temp = Number(u.temp);
    demo = Number(u.demo);
  }
  const driver = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  return {
    database,
    redis: redisStatus,
    mail: { enabled: mailEnabled(), pending, failed },
    storage: { driver, detail: driver === "s3" ? `bucket ${process.env.S3_BUCKET ?? "(unset)"}` : "local disk (UPLOAD_DIR)" },
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    providers: PROVIDERS.map((id) => ({ id, configured: isConfigured(id), redirectUri: redirectUri(id) })),
    adminsWithTempPassword: temp,
    demoAccounts: demo,
  };
}
