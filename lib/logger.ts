type Fields = Record<string, unknown>;

/** One JSON line per event, so Vercel log drains can index the fields. Errors keep name, message and stack. */
export function formatLog(level: "info" | "warn" | "error", msg: string, fields: Fields = {}): string {
  return JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields }, (_k, v) =>
    v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v,
  );
}

export const logger = {
  info: (msg: string, fields?: Fields) => console.log(formatLog("info", msg, fields)),
  warn: (msg: string, fields?: Fields) => console.warn(formatLog("warn", msg, fields)),
  error: (msg: string, fields?: Fields) => console.error(formatLog("error", msg, fields)),
};
