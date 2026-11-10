import { HttpError } from "./errors";
import { withTx } from "./db";

export type Provider = "google" | "facebook";
export const PROVIDERS: readonly Provider[] = ["google", "facebook"];

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

interface ProviderConfig {
  label: string;
  authUrl: string;
  tokenUrl: string;
  userUrl: string;
  scope: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * Endpoint URLs can be overridden with OAUTH_<PROVIDER>_{AUTH,TOKEN,USER}_URL,
 * which is how the flow is tested against a local mock provider.
 */
function config(provider: Provider): ProviderConfig {
  const P = provider.toUpperCase();
  const env = (k: string) => process.env[`OAUTH_${P}_${k}`] || undefined;
  const base =
    provider === "google"
      ? {
          label: "Google",
          authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
          tokenUrl: "https://oauth2.googleapis.com/token",
          userUrl: "https://openidconnect.googleapis.com/v1/userinfo",
          scope: "openid email profile",
        }
      : {
          label: "Facebook",
          authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
          tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
          userUrl: "https://graph.facebook.com/v19.0/me?fields=id,name,email",
          scope: "email,public_profile",
        };
  return {
    ...base,
    authUrl: env("AUTH_URL") ?? base.authUrl,
    tokenUrl: env("TOKEN_URL") ?? base.tokenUrl,
    userUrl: env("USER_URL") ?? base.userUrl,
    clientId: env("CLIENT_ID"),
    clientSecret: env("CLIENT_SECRET"),
  };
}

export function isConfigured(provider: Provider): boolean {
  const c = config(provider);
  return Boolean(c.clientId && c.clientSecret);
}

/** Providers with credentials set; only these get a sign-in button. */
export function enabledProviders(): { id: Provider; label: string }[] {
  return PROVIDERS.filter(isConfigured).map((id) => ({ id, label: config(id).label }));
}

export const OAUTH_COOKIE = "munfix_oauth_state";
export const OAUTH_NEXT_COOKIE = "munfix_oauth_next";
export const OAUTH_COOKIE_PATH = "/api/v1/auth/oauth";

export function appUrl(path: string): URL {
  return new URL(path, process.env.APP_URL ?? "http://localhost:3000");
}

export function redirectUri(provider: Provider): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/api/v1/auth/oauth/${provider}/callback`;
}

export function authorizeUrl(provider: Provider, state: string): string {
  const c = config(provider);
  const url = new URL(c.authUrl);
  url.searchParams.set("client_id", c.clientId ?? "");
  url.searchParams.set("redirect_uri", redirectUri(provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", c.scope);
  url.searchParams.set("state", state);
  if (provider === "google") url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export interface ProviderProfile {
  id: string;
  name: string;
  email: string | null;
  /** Whether the provider vouches that the user controls this email address. */
  emailVerified: boolean;
}

async function fetchJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new HttpError(502, "The sign-in provider rejected the request");
  return data;
}

/** Exchanges the authorization code and returns the user's profile. */
export async function fetchProfile(provider: Provider, code: string): Promise<ProviderProfile> {
  const c = config(provider);
  const token = await fetchJson(c.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: c.clientId ?? "",
      client_secret: c.clientSecret ?? "",
      redirect_uri: redirectUri(provider),
    }),
  });
  const accessToken = token.access_token;
  if (typeof accessToken !== "string") throw new HttpError(502, "The sign-in provider returned no access token");

  const me = await fetchJson(c.userUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });

  if (provider === "google") {
    if (typeof me.sub !== "string") throw new HttpError(502, "Unexpected response from Google");
    return {
      id: me.sub,
      name: typeof me.name === "string" ? me.name : "",
      email: typeof me.email === "string" ? me.email.toLowerCase() : null,
      emailVerified: me.email_verified === true,
    };
  }

  const id = typeof me.id === "string" ? me.id : null;
  if (!id) throw new HttpError(502, "Unexpected response from Facebook");
  return {
    id,
    name: typeof me.name === "string" ? me.name : "",
    email: typeof me.email === "string" ? me.email.toLowerCase() : null,
    // Facebook does not guarantee ownership of the address, so it is never used to link accounts.
    emailVerified: false,
  };
}

export type OAuthUser = { id: string; name: string; role: "citizen" | "admin" };

/**
 * Finds or creates the local user for a provider profile.
 *  1. Known provider account  -> that user.
 *  2. Verified email matching an existing user -> link and sign in.
 *  3. Unverified email matching an existing user -> refuse (could be account takeover).
 *  4. Otherwise -> create a new citizen.
 */
export async function resolveUser(provider: Provider, profile: ProviderProfile): Promise<OAuthUser> {
  return withTx(async (client) => {
    const linked = await client.query<OAuthUser>(
      `SELECT u.id, u.name, u.role FROM oauth_accounts o JOIN users u ON u.id = o.user_id
        WHERE o.provider = $1 AND o.provider_account_id = $2`,
      [provider, profile.id],
    );
    if (linked.rows[0]) return linked.rows[0];

    if (!profile.email) throw new HttpError(400, "no_email");

    const existing = await client.query<OAuthUser>(
      "SELECT id, name, role FROM users WHERE lower(email) = $1 FOR UPDATE",
      [profile.email],
    );
    let user = existing.rows[0];

    if (user) {
      if (!profile.emailVerified) throw new HttpError(409, "email_in_use");
    } else {
      const candidate = (profile.name.trim() || profile.email.split("@")[0]).slice(0, 80);
      const name = candidate.length >= 2 ? candidate : "Citizen";
      const created = await client.query<OAuthUser>(
        `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, NULL) RETURNING id, name, role`,
        [profile.email, name],
      );
      user = created.rows[0];
    }

    await client.query(
      `INSERT INTO oauth_accounts (provider, provider_account_id, user_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [provider, profile.id, user.id],
    );
    return user;
  });
}

/** Maps internal error codes to the message shown on the login page. */
export const OAUTH_ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled.",
  state: "The sign-in session expired. Please try again.",
  no_email: "Your account did not share an email address, which MunFix needs. Allow email access or sign up with email instead.",
  email_in_use: "An account with this email already exists. Log in with your password instead.",
  failed: "Sign-in failed. Please try again or use email and password.",
};
