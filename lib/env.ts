/**
 * Reads an optional setting. Empty values and unedited template text such as
 * "<your Gmail address>" or "your-16-character-app-password" count as not set, so a
 * half-filled configuration switches the feature off instead of breaking it.
 */
export function realEnv(name: string): string | undefined {
  const value = process.env[name]?.trim().replace(/^"|"$/g, "");
  if (!value) return undefined;
  if (/<[^>]*>/.test(value) || /^your[-_ ]/i.test(value) || /(provide[-_ ]later|change[-_ ]?me)/i.test(value)) return undefined;
  return value;
}

/**
 * True on a developer machine or in CI: the app's public URL points at this machine. Test accounts,
 * whose passwords are published in docs/testing-accounts.md, are only created and only accepted here.
 * Unset or any real hostname counts as not local, so production fails safe.
 */
export function isLocalEnvironment(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  try {
    const host = new URL(process.env.APP_URL ?? "").hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}
