import { pool } from "./db";
import { startMailWorker } from "./notifications";
import { ensureDatabaseReady } from "./setup";

/**
 * Runs once when the server boots. Without this, a host that starts the app with a
 * plain `npm start` has an empty database and every page that reads it returns a 500.
 * Set AUTO_SETUP=false to manage migrations yourself (`npm run db:migrate`).
 */
export async function startup(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("[startup] DATABASE_URL is not set. Pages that read reports will fail until it is configured.");
    return;
  }

  if (process.env.AUTO_SETUP !== "false") {
    try {
      await ensureDatabaseReady(pool, (m) => console.log(`[setup] ${m}`));
    } catch (err) {
      // Keep serving: /api/health reports what is wrong without exposing details to visitors.
      console.error("[startup] Database setup failed:", err instanceof Error ? err.message : err);
    }
  }

  startMailWorker();
}
