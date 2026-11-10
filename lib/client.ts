/** Turns an API error payload ({ error, issues? }) into one readable message. */
export function apiError(data: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as { error?: string; issues?: { path: string; message: string }[] };
  if (d.issues?.length) return d.issues.map((i) => i.message).join(" ");
  return d.error ?? fallback;
}

/** Only allow same-site relative redirects after login. */
export function safeNext(value: string | null | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
