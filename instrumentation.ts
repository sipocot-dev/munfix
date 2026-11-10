export async function register() {
  // Only the Node.js server runtime can reach Postgres and SMTP, and `next build` must not need a database.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { startup } = await import("./lib/startup");
  await startup();
}
