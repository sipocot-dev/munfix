import { databaseUrl, pool } from "./db";
import { startMailWorker } from "./notifications";
import { ensureDatabaseReady } from "./setup";

/**
 * Runs once when the server boots. Without this, a host that starts the app with a
 * plain `npm start` has an empty database and every page that reads it returns a 500.
 * Set AUTO_SETUP=false to manage migrations yourself (`npm run db:migrate`).
 */
export async function startup(): Promise<void> {
  if (!databaseUrl()) {
    console.error("[startup] DATABASE_URL (or POSTGRES_URL) is not set. Pages that read reports will fail until it is configured.");
    return;
  }

  if (process.env.AUTO_SETUP !== "false") {
    // Never hold up the server while the database is slow or unreachable: the first
    // attempt gets a few seconds, then retries continue in the background. Pages that
    // need a missing table also trigger setup themselves (see lib/db.ts).
    const attempt = () => ensureDatabaseReady(pool, (m) => console.log(`[setup] ${m}`));
    const retry = async () => {
      for (const [i, wait] of [2, 5, 10, 20, 30, 60, 60, 120].entries()) {
        await new Promise((r) => setTimeout(r, wait * 1000));
        try {
          await attempt();
          return;
        } catch (err) {
          console.error(`[startup] Database setup retry ${i + 1} failed:`, err instanceof Error ? err.message : err);
        }
      }
    };
    try {
      await Promise.race([attempt(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("setup still running after 8s")), 8000))]);
    } catch (err) {
      console.error("[startup] Database setup not finished:", err instanceof Error ? err.message : err);
      void retry();
    }
  }

  startMailWorker();
}
