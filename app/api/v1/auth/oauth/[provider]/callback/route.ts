import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/client";
import { HttpError } from "@/lib/errors";
import {
  appUrl,
  fetchProfile,
  isConfigured,
  isProvider,
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  OAUTH_ERRORS,
  OAUTH_NEXT_COOKIE,
  resolveUser,
} from "@/lib/oauth";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";

type Ctx = { params: Promise<{ provider: string }> };

function sameState(a: string | undefined, b: string | null): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function fail(code: string): NextResponse {
  const res = NextResponse.redirect(appUrl(`/login?error=${OAUTH_ERRORS[code] ? code : "failed"}`));
  res.cookies.delete({ name: OAUTH_COOKIE, path: OAUTH_COOKIE_PATH });
  res.cookies.delete({ name: OAUTH_NEXT_COOKIE, path: OAUTH_COOKIE_PATH });
  return res;
}

/** Step 2: the provider sends the user back here with a one-time code. */
export async function GET(req: NextRequest, { params }: Ctx): Promise<Response> {
  const { provider } = await params;
  if (!isProvider(provider) || !isConfigured(provider)) return fail("failed");

  const sp = req.nextUrl.searchParams;
  const cookieState = req.cookies.get(OAUTH_COOKIE)?.value;
  const next = safeNext(req.cookies.get(OAUTH_NEXT_COOKIE)?.value);

  if (sp.get("error")) return fail("cancelled");
  const code = sp.get("code");
  // The state must match the cookie set when this flow started (CSRF protection).
  if (!code || !sameState(cookieState, sp.get("state"))) return fail("state");

  try {
    await enforceRateLimit(`oauth:${clientIp(req)}`, 20, 900);
    const profile = await fetchProfile(provider, code);
    const user = await resolveUser(provider, profile);
    await createSession({ userId: user.id, name: user.name, role: user.role });

    const res = NextResponse.redirect(appUrl(user.role === "admin" && next === "/" ? "/admin" : next));
    res.cookies.delete({ name: OAUTH_COOKIE, path: OAUTH_COOKIE_PATH });
    res.cookies.delete({ name: OAUTH_NEXT_COOKIE, path: OAUTH_COOKIE_PATH });
    return res;
  } catch (err) {
    if (err instanceof HttpError && OAUTH_ERRORS[err.message]) return fail(err.message);
    console.error("[oauth]", provider, err);
    return fail("failed");
  }
}
