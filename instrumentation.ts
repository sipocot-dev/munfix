export async function register() {
  // Only the Node.js server runtime can reach Postgres and SMTP, and `next build` must not need a database.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { startup } = await import("./lib/startup");
  await startup();
}

/** Logs the real error behind "Something went wrong" pages. The page only shows a digest; match it to this line. */
export async function onRequestError(err: unknown, request: { path: string; method: string }) {
  const e = err as { message?: string; digest?: string; stack?: string };
  console.error(`[error] ${request.method} ${request.path} digest=${e.digest ?? "-"} ${e.message ?? err}`);
  if (e.stack) console.error(e.stack.split("\n").slice(0, 6).join("\n"));
}
