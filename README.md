# MunFix · Sipocot

A civic reporting platform for Sipocot, Camarines Sur that enables citizens to report infrastructure issues, view them on a map, and track resolution progress.

Inspired by [CitiFix](https://github.com/KishonShrill/CitiFix), rebuilt on **Next.js + PostgreSQL + Redis** with no third-party services required: photos are stored on disk, sessions live in Redis, and the map uses open tiles.

## How it works

1. A citizen signs up, pins a problem on the map, picks a category, and attaches up to 3 photos.
2. The report is **private** (visible only to its author and city staff) until a moderator verifies it.
3. Moderators review, then publish (`verified`), reject (with a reason), or mark duplicates.
4. Verified reports appear on the public map. Staff move them through `in_progress` → `resolved`, and every step shows on a public timeline.
5. Every status change is written to an **audit log**.

```
submitted → under_review → verified → in_progress → resolved
                 ↘ rejected / duplicate        (citizens can withdraw while submitted / under review)
```

## Stack

| Concern | Choice |
| --- | --- |
| App | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Database | PostgreSQL 16 (`pg`, plain SQL migrations in `db/migrations`) |
| Redis | Sessions (7-day, hashed token), read-through cache for map/stats queries, rate limiting |
| Maps | MapLibre GL with raster tiles (OpenStreetMap by default) |
| Auth | Email + password (bcrypt) and optional Google / Facebook sign-in, httpOnly cookie, roles: `citizen`, `admin` |
| Email | SMTP via Nodemailer (any provider), sent from a Postgres outbox with automatic retries |
| Photos | Validated by magic bytes; stored on local disk or any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO, B2); always served through an access-checked route |

Redis is an optimisation, not a dependency of correctness for reads: if it is down the cache is bypassed and the database answers directly.

## Quick start

Requires Node.js 22+ and Docker.

```bash
npm install
cp .env.example .env
npm run services:up        # PostgreSQL + Redis
npm run db:migrate
SEED_DEMO=true npm run db:seed   # categories, admin account, a few demo reports
npm run dev                # http://localhost:3000
```

Default admin (from `.env`): `admin@munfix.local` / `change-me-please`. **Change `SEED_ADMIN_PASSWORD` before deploying.**
Demo citizen (only with `SEED_DEMO=true`): `demo.citizen@munfix.local` / `demo-password`.

Run everything in containers instead:

```bash
docker compose --profile full up --build
```

## Deploying

Run `npm run build` then `npm start` (or use the Dockerfile). Required environment variables: `DATABASE_URL`, `REDIS_URL`, `APP_URL` (your public `https://` URL), and `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` for the first admin. The `NEXT_PUBLIC_*` values are baked in at **build** time, so set them before building.

On every start the app applies pending database migrations and seeds the categories and admin account, so a plain `npm start` against an empty database works. Set `AUTO_SETUP=false` if you prefer to run `npm run db:migrate` and `npm run db:seed` yourself.

### Troubleshooting

**"Application error: a server-side exception has occurred" / HTTP 500**: open `/api/health`. It reports, without exposing secrets, whether the database is reachable, whether migrations are applied, and whether Redis is up:

| `/api/health` says | Fix |
| --- | --- |
| `database: error: DATABASE_URL is not set` | Set `DATABASE_URL` and restart |
| `database: error: cannot connect (ECONNREFUSED / ENOTFOUND / 28P01 …)` | Wrong host, port, or credentials in `DATABASE_URL`; managed databases often need `?sslmode=require` |
| `migrations: error: database is not set up` | Restart with `AUTO_SETUP` on, or run `npm run db:migrate` |
| `redis: error: unreachable` | Pages still load, but login and sessions fail. Fix `REDIS_URL` |

The server log has the full error and a matching `digest` reference (also shown to visitors as "Reference").

## Configuration

See [`.env.example`](.env.example). The `NEXT_PUBLIC_*` values are inlined at build time:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `REDIS_URL` | Service connections |
| `AUTO_SETUP` | `true` (default) migrates and seeds on startup; `false` to do it manually |
| `APP_URL` | Public URL; `https://` marks session cookies `Secure` |
| `STORAGE_DRIVER` | `local` (default) or `s3` |
| `UPLOAD_DIR` | Photo directory for the `local` driver (use a persistent volume) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PREFIX` | `s3` driver settings. R2: `S3_REGION=auto` and its account endpoint. MinIO: `S3_FORCE_PATH_STYLE=true` |
| `SMTP_URL` or `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`, `MAIL_FROM` | Email notifications (see below). Unset = email disabled |
| `OAUTH_GOOGLE_*`, `OAUTH_FACEBOOK_*` | `CLIENT_ID` / `CLIENT_SECRET` for social sign-in (see below) |
| `NEXT_PUBLIC_MAP_CENTER_*` | Initial map center (Sipocot by default) |
| `NEXT_PUBLIC_MAP_BOUNDS` | `minLng,minLat,maxLng,maxLat` — reports must be pinned inside this box |
| `NEXT_PUBLIC_MAP_TILE_URL` | Tile template. The public OSM server is for development only; use a tile provider in production |

The municipality is configuration, not code: change the name, province, center and bounds to deploy for another city.

## Email notifications

Set `SMTP_URL` (or `SMTP_HOST` and friends) and `MAIL_FROM`, then check it with `npm run mail:test -- you@example.com`. Any SMTP provider works: Amazon SES, Brevo, Mailgun, Resend, Gmail with an app password, and so on. With no SMTP settings, email is off and the rest of the app is unaffected.

Reporters are emailed when their report is **received**, **verified**, **started**, **resolved** (or **reopened**), **rejected** (with the reason), or **merged as a duplicate**. Moving a report to "under review" sends nothing, and withdrawing sends nothing. Staff notes appear in the email. Reporters can turn emails off from **My reports**.

How delivery works:
- The email is written to an `email_outbox` table **in the same transaction** as the status change, so a notification is never lost and never sent for a change that rolled back.
- It is sent right after the change commits. If the mail server is down, the change still succeeds, and a background worker retries with growing delays (2, 4, 8 … up to 60 minutes) and gives up after 8 attempts. Failures are visible in `email_outbox.last_error`.
- Several app instances can run at once: rows are claimed with `FOR UPDATE SKIP LOCKED`, so each email is sent once. Sent rows are deleted after 30 days.
- All user-supplied text (names, titles, notes) is HTML-escaped.
- Emails carry a link to turn them off in **My reports**, not a one-click unsubscribe header.

## Social sign-in

Set `OAUTH_<PROVIDER>_CLIENT_ID` and `_CLIENT_SECRET` and the "Continue with Google/Facebook" button appears; leave them unset and the provider is hidden. Register this redirect URI with the provider (`APP_URL` must be the public URL):

```
<APP_URL>/api/v1/auth/oauth/google/callback
<APP_URL>/api/v1/auth/oauth/facebook/callback
```

- For munfix.bettersipocot.org the URIs are `https://munfix.bettersipocot.org/api/v1/auth/oauth/google/callback` and `.../facebook/callback` (also listed on **Admin → System**).
- Google: Cloud Console → APIs & Services → Credentials → OAuth client ID (Web); set the consent screen's privacy policy to `/privacy`. Facebook: developers.facebook.com → app with Facebook Login; set Privacy Policy URL `/privacy` and Data Deletion Instructions URL `/data-deletion`.
- Google needs the `openid email profile` scopes; Facebook needs `email` and `public_profile`.
- A provider account that has never signed in creates a new citizen. Provider sign-in never creates or promotes staff; administrators are created by the seed/`admin:create` or by another administrator.
- **Account linking:** a *verified* Google email that matches an existing account links to it. Facebook does not guarantee that the user owns an address, so a Facebook email that matches an existing account is refused (the user logs in with their password instead). This prevents account takeover.
- The flow uses a one-time `state` cookie for CSRF protection. Accounts created via a provider have no password.

## Roles and administrator accounts

| Role | Can do |
| --- | --- |
| **Citizen** | Report problems, follow and withdraw their own reports, manage their account. |
| **Moderator** | Review new reports: start review, verify & publish, reject (with reason), mark duplicate. Sees reporters and the overview. |
| **Field staff** | Works published reports only: mark *in progress* and *resolved*. Can be limited to certain categories (none selected = all). Never sees unreviewed reports or reporter identities. |
| **Administrator** | Everything above, plus users and roles, the audit log (reports and account changes) and the System page. |

Every status change and account change is written to the audit log. The server enforces all of this; hiding buttons is only a convenience.

**Administrator credentials**

- The first administrator is created on startup from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. In production a weak or default password is refused (12+ characters, not a common password). The account must change its password at first login.
- To create or recover an administrator from the server (no web access needed):

  ```bash
  npm run admin:create -- --email you@example.com --name "Your Name"
  npm run admin:create -- --email you@example.com --reset   # new password for an existing account
  ```

  It prints a random password once; the account is forced to choose a new one at first login and all its sessions are revoked.
- Administrators create moderator/staff accounts on **Admin → Users**; a one-time temporary password is shown once and must be changed at first login.
- Safeguards: you cannot change your own role or deactivate yourself, and the last active administrator can never be demoted or disabled. Role, deactivation and password changes sign the person out everywhere immediately.
- Citizens can reset a forgotten password by email (needs SMTP) and delete their own account (anonymised; staff accounts must be demoted first).
- `SEED_DEMO=true` also creates `demo.moderator@munfix.local` and `demo.staff@munfix.local` (password `demo-password`). Never enable it in production.

Pages: `/admin` (work queue), `/admin/overview` (charts), `/admin/users`, `/admin/audit`, `/admin/system` (service health, email test, exact OAuth redirect URIs), `/account`, `/forgot-password`, and the `/privacy`, `/terms`, `/data-deletion` pages that Google and Facebook require for app review.

## API

All endpoints are under `/api/v1`. Errors are `{ "error": string }` (validation errors add `issues`).

**Public**
- `GET /categories`
- `GET /reports?bbox=minLng,minLat,maxLng,maxLat&status=verified,resolved&category=roads&limit=500` — published reports only
- `GET /reports/:id` — public if published; otherwise only for the owner and admins
- `GET /media/:name` — report photos (same visibility rules as the report)

**Auth**
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`
- `GET /auth/oauth/:provider` (start) and `GET /auth/oauth/:provider/callback` — browser redirects, not JSON

**Citizen** (logged in)
- `POST /reports` — `multipart/form-data` (`title`, `description`, `categorySlug`, `lat`, `lng`, `barangay?`, `address?`, `photos` ×3) or JSON
- `GET /me/reports`
- `PATCH /reports/:id` — edit while `submitted`
- `DELETE /reports/:id` — withdraw while `submitted` / `under_review`

**Admin**
- `GET /admin/reports?status=submitted,under_review` — moderation queue
- `POST /admin/reports/:id/transition` — `{ "to": "verified", "note"?, "duplicateOf"? }`
- `GET /admin/audit-logs?limit=&offset=`

## Project layout

```
app/                 Pages and API route handlers (`api/health` for diagnostics)
  api/v1/            REST API
  admin/             Moderation queue and audit log
  reports/[id]/      Public report page with timeline
  report/new/        Submit a report
components/          Map, forms, moderation controls
lib/                 Database, Redis, sessions, caching, rate limits, report logic
db/migrations/       SQL migrations (applied in order, tracked in schema_migrations)
scripts/             migrate.ts, seed.ts and mail-test.ts
instrumentation.ts    Starts the email retry worker with the server
```

## Notes

- Rate limits (Redis): 5 sign-ups/hour/IP, login attempts per IP and per email, 10 reports/hour/user.
- The barangay field suggests the 46 barangays of Sipocot but accepts any text.
- Photos default to local disk. Running more than one app instance? Use `STORAGE_DRIVER=s3`. Existing local photos are not migrated automatically; copy the files in `UPLOAD_DIR` into the bucket under the same names.
