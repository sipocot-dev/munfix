import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/client";
import { appUrl, authorizeUrl, isConfigured, isProvider, OAUTH_COOKIE, OAUTH_COOKIE_PATH, OAUTH_NEXT_COOKIE } from "@/lib/oauth";

type Ctx = { params: Promise<{ provider: string }> };

/** Step 1: send the browser to the provider's consent screen. */
export async function GET(req: NextRequest, { params }: Ctx): Promise<Response> {
  const { provider } = await params;
  if (!isProvider(provider) || !isConfigured(provider)) {
    return NextResponse.redirect(appUrl("/login?error=failed"));
  }

  const state = randomBytes(24).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(provider, state));
  const opts = {
    httpOnly: true,
    // Lax so the cookie is sent when the provider redirects back with a top-level GET.
    sameSite: "lax" as const,
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: OAUTH_COOKIE_PATH,
    maxAge: 600,
  };
  res.cookies.set(OAUTH_COOKIE, state, opts);
  res.cookies.set(OAUTH_NEXT_COOKIE, safeNext(req.nextUrl.searchParams.get("next")), opts);
  return res;
}
