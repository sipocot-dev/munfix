import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Role } from "./permissions";
import { redis } from "./redis";

const COOKIE = "munfix_session";
const TTL_SECONDS = 60 * 60 * 24 * 7;

export interface Session {
  userId: string;
  name: string;
  role: Role;
  /** Set for accounts created with a temporary password until the user chooses their own. */
  mustChangePassword?: boolean;
}

function key(token: string): string {
  // Only a hash of the token is stored server-side.
  return `sess:${createHash("sha256").update(token).digest("hex")}`;
}

/** Per-user index of live session keys, so every session can be revoked at once. */
const userIndex = (userId: string) => `usess:${userId}`;

function secureCookies(): boolean {
  return (process.env.APP_URL ?? "").startsWith("https://");
}

/** Route handlers only: sets the session cookie. */
export async function createSession(session: Session): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const k = key(token);
  await redis.multi().set(k, JSON.stringify(session), "EX", TTL_SECONDS).sadd(userIndex(session.userId), k).expire(userIndex(session.userId), TTL_SECONDS).exec();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const raw = await redis.get(key(token));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** Route handlers only. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    try {
      const k = key(token);
      const raw = await redis.get(k);
      await redis.del(k);
      if (raw) await redis.srem(userIndex((JSON.parse(raw) as Session).userId), k);
    } catch {
      // ignore
    }
  }
  jar.delete(COOKIE);
}

/**
 * Signs a user out everywhere. Call after a role change, deactivation or password
 * change, so old sessions can't keep stale permissions.
 */
export async function revokeUserSessions(userId: string): Promise<void> {
  try {
    const keys = await redis.smembers(userIndex(userId));
    if (keys.length > 0) await redis.del(...keys);
    await redis.del(userIndex(userId));
  } catch (err) {
    console.error("[session] could not revoke sessions for", userId, err);
  }
}
