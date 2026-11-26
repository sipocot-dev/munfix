import { redis } from "./redis";
import { HttpError } from "./errors";

export function clientIp(req: Request): string {
  // X-Real-IP is set by the edge (Vercel, a typical nginx) and overwrites anything the client sent.
  // Otherwise use the last X-Forwarded-For hop, the one our own proxy appended: the first hop is whatever the client claims.
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    "unknown"
  );
}

/**
 * Fixed-window limiter. Fails open if Redis is unreachable so an outage
 * doesn't take the whole site down.
 */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  try {
    const k = `rl:${key}`;
    const results = await redis.multi().incr(k).expire(k, windowSeconds, "NX").ttl(k).exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    const ttl = Number(results?.[2]?.[1] ?? windowSeconds);
    if (count > limit) {
      const retryAfter = String(Math.max(ttl, 1));
      throw new HttpError(429, "Too many requests. Please try again later.", { retryAfter: Number(retryAfter) }, {
        "Retry-After": retryAfter,
      });
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.warn("[rate-limit] redis unavailable, allowing request");
  }
}
