import { redis } from "./redis";
import { HttpError } from "./errors";

export function clientIp(req: Request): string {
  // Behind a trusted reverse proxy, the first hop is the client.
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
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
