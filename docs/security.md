# Security review (sessions, passwords, encryption, rate limits)

Reviewed in November 2026 against the code in `lib/session.ts`, `lib/passwords.ts`, `lib/rate-limit.ts`, `lib/api.ts` and `next.config.ts`.

## What is in place

- **Session cookie:** httpOnly, SameSite=lax, Secure in production, 7-day TTL. The server stores only a SHA-256 hash of the token in Redis (`sess:<hash>`), so a Redis dump does not reveal live tokens.
- **Passwords:** bcrypt with cost 11. Reset tokens are single use.
- **Rate limits:** login (per IP and per email), registration, password reset, OAuth callback. Fixed-window counters in Redis. The limiter fails open if Redis is down, which keeps the site up but removes the limit during an outage.
- **Headers:** X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, and a partial CSP (`frame-ancestors 'none'; object-src 'none'; base-uri 'self'`) in `next.config.ts`. HSTS is added by Vercel.
- **Cross-site writes:** `route()` rejects POST/PATCH/DELETE whose `Origin` is not the app's own. SameSite=lax alone still sends the cookie from sibling subdomains of the same site.
- **Post-login redirects:** `safeNext()` parses the target the way a browser does and keeps only same-origin paths (`/\evil.com` used to pass).
- **Input validation:** zod schemas at every route boundary; errors return 400 with field messages.

## Gaps and decisions

1. **Client IP trust.** `clientIp()` now uses `X-Real-IP` (Vercel sets it and overwrites any client value), else the last `X-Forwarded-For` hop. **Open question:** the site sits behind Cloudflare's proxy, so Vercel may see a Cloudflare edge address instead of the visitor's. In that case every visitor behind the same edge shares one per-IP bucket. Check one request's `x-real-ip` in the Vercel logs. If it is a Cloudflare address, either switch the DNS record to DNS-only or decide whether to trust `CF-Connecting-IP`. Trusting it is only safe if the origin cannot be reached directly through `*.vercel.app`.
2. **Field encryption.** The app stores names, emails, and report locations. Passwords are already hashed, and nothing else is classed as sensitive. Field-level encryption is not added yet: it would break email lookups unless a deterministic hash is kept alongside. Add an AES-256-GCM helper only if the data changes (for example phone numbers or ID documents).
3. **Fail-open limiter.** Acceptable for availability; add an alert on Redis errors (the health endpoint already reports Redis as unreachable).
4. **Secrets.** Rotate any secret that appeared in chat or logs: the database password and the Facebook app secret.
5. **No email verification.** Anyone can register with an address they do not own. A later Google sign-in with that verified address is linked to the existing account, whose password the first registrant still knows (account pre-hijacking). Registration also answers 409 for a taken address (enumeration). Both need a product decision: verify the address before activating password accounts, or refuse to link OAuth to password accounts that were never verified.
6. **Content-Security-Policy.** There is no `script-src` policy yet. A strict one needs per-request nonces (Next.js middleware). Try it in `Content-Security-Policy-Report-Only` first, because MapLibre workers, Vercel Analytics and inline Next scripts all need allowances.
7. **PDF attachments** are served inline from the app origin. Browser PDF viewers sandbox them, but serving them from a separate domain or with `Content-Disposition: attachment` would remove the residual risk.
