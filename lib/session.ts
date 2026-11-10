import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redis } from "./redis";

const COOKIE = "munfix_session";
const TTL_SECONDS = 60 * 60 * 24 * 7;

export interface Session {
  userId: string;
  name: string;
  role: "citizen" | "admin";
}

function key(token: string): string {
  // Only a hash of the token is stored server-side.
  return `sess:${createHash("sha256").update(token).digest("hex")}`;
}

function secureCookies(): boolean {
  return (process.env.APP_URL ?? "").startsWith("https://");
}

/** Route handlers only: sets the session cookie. */
export async function createSession(session: Session): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await redis.set(key(token), JSON.stringify(session), "EX", TTL_SECONDS);
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
      await redis.del(key(token));
    } catch {
      // ignore
    }
  }
  jar.delete(COOKIE);
}
