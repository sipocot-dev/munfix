import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { redis } from "@/lib/redis";
import { migrationFiles } from "@/lib/setup";

export const dynamic = "force-dynamic";

const timeout = <T>(p: Promise<T>, ms = 4000): Promise<T> =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

/**
 * Open /api/health to see why the site is failing. Messages are deliberately coarse:
 * they say what is wrong, never hostnames, credentials or stack traces.
 */
export async function GET() {
  const checks: Record<string, string> = {};

  if (!process.env.DATABASE_URL) {
    checks.database = "error: DATABASE_URL is not set";
  } else {
    try {
      await timeout(query("SELECT 1"));
      checks.database = "ok";
    } catch (err) {
      const code = (err as { code?: string }).code;
      checks.database = `error: cannot connect (${code ?? (err as Error).message})`;
    }
  }

  if (checks.database === "ok") {
    try {
      const done = new Set(
        (await timeout(query<{ name: string }>("SELECT name FROM schema_migrations"))).map((r) => r.name),
      );
      const pending = (await migrationFiles()).filter((f) => !done.has(f));
      checks.migrations = pending.length === 0 ? "ok" : `error: ${pending.length} pending (run npm run db:migrate, or leave AUTO_SETUP on)`;
    } catch {
      checks.migrations = "error: database is not set up (run npm run db:migrate, or leave AUTO_SETUP on)";
    }
  }

  try {
    await timeout(redis.ping());
    checks.redis = "ok";
  } catch {
    checks.redis = "error: unreachable (sessions and login will not work)";
  }

  const healthy = checks.database === "ok" && checks.migrations === "ok";
  return NextResponse.json({ status: healthy ? "ok" : "unhealthy", checks }, { status: healthy ? 200 : 503 });
}
