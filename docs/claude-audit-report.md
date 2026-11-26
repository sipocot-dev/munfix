# MunFix full-stack audit — November 2026

Branch `claude/munfix-fullstack-audit`, based on `main` at `5e580c2`. Task: [`docs/CLAUDE_CODE_AUDIT_TASK.md`](CLAUDE_CODE_AUDIT_TASK.md), issue #12.

## 1. Summary and scope

**Result:** one high-severity defect was confirmed and fixed. Any post-login redirect could be sent to another site. Seventeen lower-severity defects and hardening gaps were also fixed, and 59 regression tests were added (24 → 83). Typecheck, tests, the production dependency audit and the production build all pass. Twelve items are left open: they need a product decision, production access, or cloud configuration (section 5).

**Reviewed**

- Every API route (`app/api/**`) and server module (`lib/**`): auth, sessions, password reset, OAuth, reports, media, profile/preferences, admin, audit log, health, cron/email, rate limits, cache, database, setup.
- All pages and components, for authorization, redirects, state handling, accessibility and upload behaviour.
- Dockerfile, docker-compose, `vercel.json`, `next.config.ts`, both GitHub workflows, `.env.example`, README and docs.
- The live site, with low-volume `curl` only: status codes and redirects for 24 public routes, response headers, `/api/health`, the public reports API, the OAuth start route, and the map tile URL in the shipped JavaScript.

**Not done (and why)**

- **No browser-based review.** Neither Chromium nor Playwright was available in the audit environment, and there was no container runtime, so console errors, visual responsive layout, contrast and focus order on the live site were **not** inspected. The accessibility fixes below come from code review.
- No account was created, no form was submitted, and no OAuth login was completed on the live site.
- No Postgres/Redis integration tests: no container runtime was available. The new tests use mocked database and Redis modules.
- The Docker image was **not built** after the Dockerfile change, for the same reason.

## 2. Findings

Severity is the impact on this deployment as it stands. "Fixed" items have regression tests unless marked otherwise.

| # | Severity | Finding | Paths | Evidence | Impact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | **High** | Open redirect after login. `safeNext()` only checked "starts with `/`, not `//`", so `/\evil.com`, `/\/evil.com` and `/<tab>/evil.com` passed. Browsers and `new URL()` resolve those to `https://evil.com/`. | `lib/client.ts`; used by `AuthForm`, `/login`, `/register`, OAuth start and callback | `new URL("/\\example.com", "https://munfix.bettersipocot.org")` → `https://example.com/`. On the live site, the login page renders `?next=/\example.com` straight into the Facebook button's link, and the OAuth callback redirects to `appUrl(next)`. | After a real login on the real domain, the user lands on an attacker's page (for example a fake "session expired, sign in again" page). | Fixed: the target is parsed like a browser would and must stay same-origin. Tests show the old code fails 4 bypass cases. |
| F2 | Medium | Feedback and follow-up entries had no rate limit, and they show publicly on the report page. | `lib/reports.ts` `addActivity` | No `enforceRateLimit` on either route | One account can flood any public report's history. | Fixed: 20 per hour per account. |
| F3 | Medium | Demo logins could be created in production with the public default password `demo-password`, and one of them is a **moderator**. `demo-password` also passed the "strong bootstrap password" check. | `lib/setup.ts`, `lib/passwords.ts` | Only gated by `SEED_DEMO_ACCOUNTS=true`. Whether it is set in production is unknown. | Anyone could moderate reports and see reporters' names and emails. | Fixed: in production, demo accounts need a strong `DEMO_PASSWORD`; `demo-password` is now on the common list. |
| F4 | Low | Cookie-authenticated writes relied on SameSite=lax alone. Lax still sends the cookie from sibling subdomains of the same registrable domain (`*.bettersipocot.org`). | `lib/api.ts` | No Origin check anywhere | A compromised or hostile sibling subdomain could post as a signed-in user. | Fixed: `route()` rejects writes whose `Origin` is not the app's own. Requests without `Origin` (non-browser) are unaffected. |
| F5 | Low | Login timing revealed registered emails. Unknown emails were compared against a cost-10 dummy hash; real hashes are cost 11. | `app/api/v1/auth/login/route.ts` | Measured locally: 137 ms vs 166 ms | Email enumeration by timing (registration already reveals it, see O2). | Fixed: the dummy hash is made with `hashPassword`. |
| F6 | Low | `clientIp()` trusted the first `X-Forwarded-For` hop, which the client controls on any host that appends to the header. | `lib/rate-limit.ts` | Code | Per-IP limits could be bypassed (on Vercel the header is overwritten, so mainly self-hosting). | Fixed: `X-Real-IP` first, then the last hop. See O4 for Cloudflare. |
| F7 | Low | Public photos were served with `public, max-age=86400, immutable`, but a verified report can still be rejected. Cloudflare caches `.jpg`/`.png` by default. | `app/api/v1/media/[name]/route.ts` | Code (no live report currently has a photo, so this was not observed) | A rejected report's photo stays public in shared caches for a day. | Fixed: `public, max-age=300`. |
| F8 | Low | When statistics failed to load, the home page showed `0 / 0 / 0`. | `app/page.tsx`, `components/Explorer.tsx` | Code | Looks like "nothing reported" instead of "unavailable". | Fixed: shows `—`. Not unit-tested (UI). |
| F9 | Low | Report form: PDFs are not shrunk, so a few of them exceed the host's ~4.5 MB request limit. Users then got a generic error, and an image the browser could not decode caused an unhandled rejection. | `components/ReportForm.tsx` | Code; Vercel's documented body limit | The user cannot tell why the submission failed. | Fixed: total-size check, a clear 413 message, and a fallback when shrinking fails. Not unit-tested (UI). |
| F10 | Low | Accessibility: the location picker was mouse-only, the map and the file input had no accessible names, and the stats list had `dd` before `dt`. | `components/LocationPicker.tsx`, `ReportForm.tsx`, `Explorer.tsx` | Code | Keyboard and screen-reader users could not place a pin. | Fixed: "Pin map centre" button (pan with the arrow keys, then pin), labels, list order. Not unit-tested (UI). |
| F11 | Low | No Content-Security-Policy. | `next.config.ts` | Live headers | Defense in depth only (X-Frame-Options already blocks framing). | Partly fixed: `frame-ancestors 'none'; object-src 'none'; base-uri 'self'`. A script policy is open (O6). Checked in a local `next start`. |
| F12 | Low | The cron secret was compared with `!==`, which is not constant-time. | `app/api/cron/mail/route.ts` | Code | Theoretical timing leak of `CRON_SECRET`. | Fixed: `timingSafeEqual`. |
| F13 | Low | Container ran as root, had no health check, and `sh -c` did not `exec` the server. | `Dockerfile` | Code | A broader blast radius if the app is compromised; slower shutdown. | Fixed: `USER node`, `HEALTHCHECK` on `/api/health`, `exec`. **Image not built here.** |
| F14 | Low | Compose published Postgres (password `munfix`) and Redis (no password) on every network interface. | `docker-compose.yml` | Code | Dev databases reachable from the local network. | Fixed: bound to 127.0.0.1. |
| F15 | Low | The backup uploaded whatever `pg_dump` produced, without checking it. | `.github/workflows/backup.yml` | Code | A truncated or empty backup would only be found during a restore. | Fixed: `gzip -t`, the "dump complete" trailer, and a `schema_migrations` check. Tried locally against a good and a truncated dump. |
| F16 | Info | `dump.rdb` (a Redis snapshot) was committed. | repo root | All 5 historical versions are 89 bytes with no keys (inspected) | None today, but a later commit could leak sessions. | Removed and added to `.gitignore`. |
| F17 | Info | `/favicon.ico` returned 404 on every page load. | `app/` | Live `curl` | Console noise. | Fixed: `app/icon.svg`. |
| F18 | Info | The README said `SEED_DEMO=true` creates the demo login (it is `SEED_DEMO_ACCOUNTS`), and `CRON_SECRET`, `DATABASE_SCHEMA`, `AWS_ROLE_ARN` and `NEXT_PUBLIC_MAP_STYLE` were undocumented. | `README.md`, `.env.example` | Code vs docs | Misconfiguration | Fixed. |

**Checked and found sound** (covered by new tests where noted): session tokens (32 random bytes, only the SHA-256 is stored, httpOnly/Secure/lax, revoked on role, active-state and password changes); password reset (32-byte token, hashed, 60-minute expiry, single use, revokes sessions, same answer for unknown emails); OAuth `state` (constant-time compare, 10-minute cookie; Facebook email never links accounts); the report and media permission matrix, including temporary-password sessions and the staff category scope (tests); the transition state machine and the reject-reason rule (tests); the status change, audit event and email outbox sharing one transaction; magic-byte upload checks, size and count limits, all-or-nothing storage, and path traversal (tests); SQL parameterisation throughout; pagination caps on public, admin and audit lists; HTML escaping in email templates; the last-admin guard; health output that names no hosts or credentials.

## 3. Changes

| File | Change |
| --- | --- |
| `lib/client.ts` | `safeNext` parses with `URL` and keeps only same-origin path, query and hash (F1) |
| `lib/reports.ts` | Rate limit in `addActivity` (F2) |
| `lib/setup.ts`, `lib/passwords.ts` | Production guard for demo accounts; `demo-password` added to the common list (F3) |
| `lib/api.ts` | `assertSameOrigin`, called by `route()` for every API write (F4) |
| `app/api/v1/auth/login/route.ts` | Dummy hash at the real cost (F5) |
| `lib/rate-limit.ts` | `clientIp` header order (F6) |
| `app/api/v1/media/[name]/route.ts` | Shorter public cache lifetime (F7) |
| `app/page.tsx`, `components/Explorer.tsx` | No fake zeros; valid `dl` order (F8, F10) |
| `components/ReportForm.tsx`, `components/LocationPicker.tsx` | Upload size, error handling and accessibility (F9, F10) |
| `next.config.ts` | Partial CSP (F11) |
| `app/api/cron/mail/route.ts` | Constant-time secret check (F12) |
| `Dockerfile`, `docker-compose.yml` | Non-root user, health check, `exec`; local-only ports (F13, F14) |
| `.github/workflows/backup.yml` | Dump integrity checks (F15) |
| `dump.rdb`, `.gitignore` | Removed and ignored (F16) |
| `app/icon.svg` | Favicon (F17) |
| `README.md`, `.env.example`, `docs/*.md` | Environment reference, testing, architecture, security, operations runbooks (F18) |
| `tests/unit/http-security.test.ts` | Redirects, client IP, rate limiter (429 and fail-open), Origin check |
| `tests/unit/report-access.test.ts` | Detail, media and transition permission matrix; staff scope; activity limit; transactional audit write |
| `tests/unit/uploads-and-routes.test.ts` | MIME spoofing, size and count limits, partial failure, traversal; media cache headers; cron auth; demo-account guard |
| `tests/unit/login.test.ts` | Unknown-email login uses the real bcrypt cost |

## 4. Tests and checks run

Run on Node v22.23.5 / npm 10.9.9 in the branch worktree:

| Command | Outcome |
| --- | --- |
| `npm ci` | exit 0. Note: npm reports 3 vulnerabilities (2 critical, 1 moderate) in **dev** dependencies: `vitest` 3.2.7, `@vitest/mocker`, `tinypool`. See O11. |
| `npm run typecheck` | exit 0, no errors |
| `npm test` | exit 0: **8 files, 83 tests passed** (24 before this branch) |
| `npm audit --omit=dev --audit-level=high` | exit 0, `found 0 vulnerabilities` |
| `npm run build` | exit 0, "Compiled successfully" (Next.js 15, run with `NODE_OPTIONS=--max-old-space-size=3072`) |
| Local `next start`, no database | `/login` 200 with the new CSP header; `/icon.svg` 200; `POST /api/v1/auth/logout` with `Origin: https://evil.example` → 403, with the app's own Origin → 200; `/` 200 in its degraded state |
| Backup integrity commands under `bash -eo pipefail` | Complete dump → exit 0; truncated dump → exit 1 |
| Regression check for F1 | The new `safeNext` tests run against the old implementation fail the 4 bypass cases |

Not run: Docker image build, Postgres/Redis integration tests, browser or end-to-end tests, a restore drill.

## 5. Open risks and operator actions

| # | Risk | Why it is not fixed here | Action |
| --- | --- | --- | --- |
| O1 | **Medium.** Account pre-hijacking: no email verification at registration, and a later Google sign-in with a verified address links to that pre-registered account, whose password the attacker still knows. | Product decision. Any fix changes sign-up or linking behaviour. | Choose one: (a) verify the email before activating password accounts; (b) don't auto-link OAuth to password accounts whose email was never verified; (c) on link, clear the old password and force a reset. (a) is the usual answer. |
| O2 | Low. Registration answers 409 for a taken email (enumeration). | Tied to O1; the fix needs a verification email flow. | Do it together with O1. |
| O3 | **Medium (operational).** Production map tiles come from `tile.openstreetmap.org`, seen in the live JavaScript. OSM's tile policy does not allow production apps to depend on it, and access can be blocked without notice. | Needs a provider choice and account. | Choose a tile provider (for example MapTiler, Stadia or a self-hosted server), set `NEXT_PUBLIC_MAP_TILE_URL` in Vercel, and redeploy (the value is baked in at build time). Update the attribution in `lib/map.ts` if it changes. |
| O4 | Low. The site is proxied by Cloudflare, so Vercel's `X-Real-IP` may be a Cloudflare edge address, and per-IP limits may then be shared across many visitors. | Needs production logs. | Log or inspect `x-real-ip` for one request. If it is a Cloudflare address, set the DNS record to DNS-only, or trust `CF-Connecting-IP` only after blocking direct `*.vercel.app` access. |
| O5 | Low. The rate limiter fails open while Redis is down (a documented trade-off). Logins fail anyway because sessions need Redis. | Availability decision. | Alert on `redis: error` from `/api/health` (an uptime monitor on that URL). |
| O6 | Low. There is no `script-src` CSP. | Needs nonces via middleware plus testing against MapLibre, Vercel Analytics and OAuth. | Ship `Content-Security-Policy-Report-Only` first, watch for violations, then enforce. |
| O7 | Low. PDFs are served inline from the app origin. | A behaviour change for viewers. | Consider `Content-Disposition: attachment` for `.pdf`, or a separate media domain. |
| O8 | Low. Email delivery is at-least-once: a crash between SMTP send and commit resends that email. | An inherent outbox trade-off. | None needed; noted. |
| O9 | Medium (operational). Backups are not encrypted by the workflow, have no retention rule and no failure alert; photos are not backed up at all; no restore drill is recorded. | Cloud configuration. | See [operations.md § Backups](operations.md#backups): bucket encryption and lifecycle, scoped keys or OIDC, versioning on the photo bucket, and a quarterly restore drill. |
| O10 | Low. Tests mock Postgres and Redis, and there are no browser tests. | No container runtime or browser in the audit environment. | Add a CI job with `postgres:16` and `redis:7` service containers running migrations and the permission matrix against a real database, plus a Playwright smoke test (map, report form, login) at phone and desktop widths. |
| O11 | Low (dev only). `vitest` 3.2.7 has critical advisories (tinypool prototype pollution, mocker path traversal). They are exploitable only through a running Vitest server or worker, never in production. | `npm install vitest@^4.1.12` failed in this environment with an npm internal error (`Cannot read properties of null (reading 'edgesOut')`). Vitest 3 was pinned deliberately after the Dependabot major-upgrade breakage. | Upgrade to Vitest ≥ 4.1.12 in a separate PR and run the suite. |
| O12 | Low. The server accepts 3 × 5 MB of attachments, but Vercel caps a request near 4.5 MB. | The client now enforces 4 MB in total; raising the real limit needs direct-to-S3 presigned uploads. | Only if larger attachments are needed. |

Also still open from `docs/security.md`: rotate the database password and Facebook app secret if they ever appeared in chat or logs.

## 6. Rollout and rollback

1. Review and merge this PR. CI runs the same checks as above.
2. Vercel deploys `main`. There are **no database migrations** in this change.
3. Smoke test: `/api/health` is ok; sign in and out; submit nothing; open a report; check the `content-security-policy` response header.
4. Watch for a rise in 403 `Cross-site request blocked` responses in the logs. That would point to an unexpected `Origin` (for example a second domain serving the app). Fix it by adding that domain as `APP_URL`, or roll back.
5. Rollback: use Vercel Instant Rollback to the previous deployment. No data or schema changes need undoing.

Self-hosted (Docker): the container now runs as `node`. An existing `uploads` volume created by the old root container may be root-owned; run `docker run --rm -v <volume>:/data/uploads alpine chown -R 1000:1000 /data/uploads` once before starting the new image.

## 7. Production was not modified

No deployment, merge, migration, database or Redis access, object-storage access, email, OAuth console, Vercel, DNS or Cloudflare change was made. No production environment variable or secret was read or changed. The live site was only read with a few dozen anonymous GET requests; no account, report or form submission was created.
