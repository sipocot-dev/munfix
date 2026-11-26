/** Turns an API error payload ({ error, issues? }) into one readable message. */
export function apiError(data: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as { error?: string; issues?: { path: string; message: string }[] };
  if (d.issues?.length) return d.issues.map((i) => i.message).join(" ");
  return d.error ?? fallback;
}

/**
 * Only allow same-site relative redirects after login. Parsed the way a browser would, because
 * "/\evil.com" and "/<tab>/evil.com" pass a plain prefix check but resolve to another host.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  const base = "http://munfix.invalid";
  try {
    const url = new URL(value, base);
    return url.origin === base ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

/** A report id from a bare UUID or a pasted report URL (…/reports/<uuid>), for the "mark duplicate" form. */
export function extractId(value: string): string {
  const m = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0].toLowerCase() : value.trim();
}
