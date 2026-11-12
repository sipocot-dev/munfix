# Security review (sessions, passwords, encryption, rate limits)

Reviewed in November 2026 against the code in `lib/session.ts`, `lib/passwords.ts`, `lib/rate-limit.ts`, `lib/api.ts` and `next.config.ts`.

## What is in place

- **Session cookie:** httpOnly, SameSite=lax, Secure in production, 1-hour-to-configured TTL. The server stores only a SHA-256 hash of the token in Redis (`sess:<hash>`), so a Redis dump does not reveal live tokens.
- **Passwords:** bcrypt with cost 11. Reset tokens are single use.
- **Rate limits:** login (per IP and per email), registration, password reset, OAuth callback. Fixed-window counters in Redis. The limiter fails open if Redis is down, which keeps the site up but removes the limit during an outage.
- **Headers:** X-Frame-Options DENY and related headers in `next.config.ts`.
- **Input validation:** zod schemas at every route boundary; errors return 400 with field messages.

## Gaps and decisions

1. **Client IP trust.** `clientIp()` takes the first entry of `X-Forwarded-For`. A client can send its own header, so per-IP limits can be bypassed unless the hosting proxy overwrites that header. Verify on Vercel which header carries the real client address and use only that one.
2. **Field encryption.** The app stores names, emails, and report locations. Passwords are already hashed, and nothing else is classed as sensitive. Field-level encryption is not added yet: it would break email lookups unless a deterministic hash is kept alongside. Add an AES-256-GCM helper only if the data changes (for example phone numbers or ID documents).
3. **Fail-open limiter.** Acceptable for availability; add an alert on Redis errors (the health endpoint already reports Redis as unreachable).
4. **Secrets.** Rotate any secret that appeared in chat or logs: the database password and the Facebook app secret.
