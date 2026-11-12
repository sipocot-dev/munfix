import { logger } from "./lib/logger";
export async function register() {
  // Only the Node.js server runtime can reach Postgres and SMTP, and `next build` must not need a database.
  // The import sits inside the branch so the edge bundle does not pull in pg (it needs fs).
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startup } = await import("./lib/startup");
    await startup();
  }
}

/** Logs the real error behind "Something went wrong" pages. The page only shows a digest; match it to this line. */
export async function onRequestError(err: unknown, request: { path: string; method: string }) {
  const e = err as { message?: string; digest?: string; stack?: string };
  logger.error("render error", { method: request.method, path: request.path, digest: e.digest ?? null, message: e.message ?? String(err), stack: e.stack?.split("\n").slice(0, 6).join("\n") });
}
