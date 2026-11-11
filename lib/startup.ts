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
    // The database container may still be starting. Retry in the background instead of
    // leaving the site half-migrated until someone restarts it.
    const delays = [0, 2, 5, 10, 20, 30, 60, 60, 120];
    for (const [i, wait] of delays.entries()) {
      if (wait) await new Promise((r) => setTimeout(r, wait * 1000));
      try {
        await ensureDatabaseReady(pool, (m) => console.log(`[setup] ${m}`));
        break;
      } catch (err) {
        // Keep serving: /api/health reports what is wrong without exposing details to visitors.
        console.error(`[startup] Database setup failed (attempt ${i + 1}/${delays.length}):`, err instanceof Error ? err.message : err);
      }
    }
  }

  startMailWorker();
}
