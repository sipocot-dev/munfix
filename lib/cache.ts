import { redis } from "./redis";

/**
 * Read-through cache. If Redis is unavailable the loader runs directly,
 * so a Redis outage degrades performance but not correctness.
 */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch {
    // fall through to the loader
  }
  const value = await load();
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // ignore cache write failures
  }
  return value;
}

/**
 * Report list/stat caches embed a version number in their keys. Bumping the
 * version invalidates every cached list at once without scanning keys.
 */
const VERSION_KEY = "reports:version";

export async function reportsVersion(): Promise<string> {
  try {
    return (await redis.get(VERSION_KEY)) ?? "0";
  } catch {
    return "0";
  }
}

export async function invalidateReports(): Promise<void> {
  try {
    await redis.incr(VERSION_KEY);
  } catch {
    // ignore
  }
}
