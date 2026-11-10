export async function register() {
  // Only the Node.js server runtime can reach Postgres and SMTP.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startMailWorker } = await import("./lib/notifications");
  startMailWorker();
}
