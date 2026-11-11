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
