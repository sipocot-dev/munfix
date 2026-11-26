# MunFix · Sipocot

A civic reporting platform for Sipocot, Camarines Sur that enables citizens to report infrastructure issues, view them on a map, and track resolution progress.

Inspired by [CitiFix](https://github.com/KishonShrill/CitiFix), rebuilt on **Next.js + PostgreSQL + Redis** with no third-party services required: photos are stored on disk, sessions live in Redis, and the map uses open tiles.

## How it works

1. A resident signs up, pins a problem on the map, picks a category, and attaches up to 3 photos.
2. The report is **public at once** on the map and in the list, without the reporter's name.
3. Moderators check new reports. They can put one **under review** (it stays public), **hide** it (off the public map, reversible, reason required), **reject** it (final, reason required), or mark it as a **duplicate**.
4. Field staff move reports through **in progress** to **resolved**; every step shows on the public timeline, and the reporter gets an email.
5. Every status change, report edit, account change and role change is written to the **audit log**.

```
submit → Published (verified) → In progress → Resolved
            ↕ Under review (still public)
            → Hidden (private, can be restored) / Rejected / Duplicate
```

Reporters can edit or withdraw their report until work starts. Reports filed before automatic publication that were still waiting for review stay private ("Awaiting review") until a moderator decides; see [docs/additional-enhancements-report.md](docs/additional-enhancements-report.md).

## Stack

| Concern | Choice |
| --- | --- |
| App | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Database | PostgreSQL 16 (`pg`, plain SQL migrations in `db/migrations`) |
| Redis | Sessions (7-day, hashed token), read-through cache for map/stats queries, rate limiting |
| Maps | MapLibre GL with OpenFreeMap vector tiles (free, no API key; light and dark styles); provider configurable ([docs/map-tiles.md](docs/map-tiles.md)) |
| Auth | Email + password (bcrypt) and optional Google / Facebook sign-in, httpOnly cookie; permission-based roles (4 built-in, plus custom roles) |
| Email | SMTP via Nodemailer (any provider), sent from a Postgres outbox with automatic retries; Mailpit catches mail in development |
| Photos | Validated by magic bytes; stored on local disk or any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO, B2); always served through an access-checked route |

Redis is an optimisation, not a dependency of correctness for reads: if it is down the cache is bypassed and the database answers directly.

## Quick start

Requires Node.js 22+ and Docker.

```bash
npm install
cp .env.example .env              # local defaults: Postgres, Redis, Mailpit SMTP, test accounts on
npm run services:up               # PostgreSQL, Redis and Mailpit
npm run db:migrate
SEED_DEMO=true npm run db:seed    # categories, roles, test accounts, a few sample reports
npm run dev                       # http://localhost:3000
```

- **Test accounts** (development and CI only): one per role, password `demo-password`. Log in at <http://localhost:3000/login> as `demo.citizen@munfix.local`, `demo.staff@munfix.local`, `demo.moderator@munfix.local` or `demo.admin@munfix.local`. Details, permissions and how to reset them: [docs/testing-accounts.md](docs/testing-accounts.md). They are only created when `APP_URL` is `localhost`, and login refuses them anywhere else.
- **Email**: every email the app sends lands in Mailpit at <http://localhost:8025> ([docs/mailpit.md](docs/mailpit.md)).
- **Theme**: Light, Dark or System, from the header (or the menu on phones). The choice is stored in the browser.

### Tests and checks

```bash
npm run typecheck
npm test                          # unit tests (Vitest); no database or Redis needed
npm run build && npm run test:e2e # end-to-end tests (Playwright); needs services:up, db:migrate and the seed above
npm audit --omit=dev --audit-level=high
```

CI runs all of these on every pull request; the end-to-end job uses Postgres, Redis and Mailpit service containers and also runs the map and navigation tests in Firefox and WebKit. See [docs/testing.md](docs/testing.md).

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
| `DATABASE_SCHEMA` | Postgres schema for MunFix's tables (default `munfix`) |
| `CRON_SECRET` | Bearer secret for `/api/cron/mail` (Vercel Cron). Unset = endpoint closed |
| `AUTO_SETUP` | `true` (default) migrates and seeds on startup; `false` to do it manually |
| `APP_URL` | Public URL; `https://` marks session cookies `Secure` |
| `STORAGE_DRIVER` | `local` (default) or `s3` |
| `UPLOAD_DIR` | Photo directory for the `local` driver (use a persistent volume) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PREFIX` | `s3` driver settings. R2: `S3_REGION=auto` and its account endpoint. MinIO: `S3_FORCE_PATH_STYLE=true` |
| `AWS_ROLE_ARN` | `s3` on Vercel with the AWS integration: OIDC role instead of static keys |
| `SEED_DEMO_ACCOUNTS`, `DEMO_PASSWORD` | Test accounts for every role ([docs/testing-accounts.md](docs/testing-accounts.md)); only on a local `APP_URL`, never in production |
| `SMTP_URL` or `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`, `MAIL_FROM` | Email notifications (see below). Unset = email disabled |
| `OAUTH_GOOGLE_*`, `OAUTH_FACEBOOK_*` | `CLIENT_ID` / `CLIENT_SECRET` for social sign-in (see below) |
| `NEXT_PUBLIC_MAP_CENTER_*` | Initial map center (Sipocot by default) |
| `NEXT_PUBLIC_MAP_BOUNDS` | `minLng,minLat,maxLng,maxLat` — reports must be pinned inside this box |
| `NEXT_PUBLIC_MAP_STYLE_URL`, `NEXT_PUBLIC_MAP_STYLE_URL_DARK` | MapLibre style for the light and dark themes (default: OpenFreeMap liberty / fiord) |
| `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` | Optional raster tile service instead of a style. Never `tile.openstreetmap.org` |
| `NEXT_PUBLIC_MAP_STYLE` | `vector` for the OpenFreeMap vector style on the explorer |

The municipality is configuration, not code: change the name, province, center and bounds to deploy for another city.

Optional settings left empty, or still holding template text such as `<your Gmail address>`, are treated as **not set**: the site runs normally and the matching feature (Facebook/Google button, email) simply stays off.

### Gmail SMTP

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourname@gmail.com
SMTP_PASSWORD=<16-character app password>   # Google Account → Security → 2-Step Verification → App passwords
SMTP_FROM="Better Sipocot <yourname@gmail.com>"
```

Gmail only sends as the authenticated address. Use **Admin → System → Send test email** to verify.

## Email notifications

Set `SMTP_URL` (or `SMTP_HOST` and friends) and `MAIL_FROM`, then check it with `npm run mail:test -- you@example.com`. Any SMTP provider works: Amazon SES, Brevo, Mailgun, Resend, Gmail with an app password, and so on. With no SMTP settings, email is off and the rest of the app is unaffected.

Reporters are emailed when their report is **published**, **put under review**, **hidden** or **restored**, **started**, **resolved** (or **reopened**), **rejected** (with the reason), or **merged as a duplicate**. Withdrawing sends nothing. Staff notes and reasons appear in the email. Reporters can turn emails off from **My reports**. Password reset links are sent by email too.

Email is MunFix's only notification channel: there are **no in-app notifications** (no bell or inbox inside the app). In development, Mailpit shows every email that would have been sent ([docs/mailpit.md](docs/mailpit.md)).

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

## Problem types

Like CitiFix, each category has a short list of specific problems (Roads → Pothole, Cracked road, Missing manhole cover…). Citizens pick one when reporting; it shows on the map popup, lists, report page and moderation queue. Types are defined in `PROBLEM_TYPES` in `lib/setup.ts` and synced on every start (edit the list, restart). Categories without types (e.g. Other) don't ask.

## Roles and administrator accounts

Access is **permission-based**: a role is a set of permissions, and every page and API checks permissions, never role names. Four built-in roles reproduce the original behaviour and cannot be changed; administrators can add **custom roles** on **Admin → Roles** ([docs/roles-and-permissions.md](docs/roles-and-permissions.md)).

| Built-in role | Can do |
| --- | --- |
| **Citizen** | Report problems, follow, edit and withdraw their own reports until work starts, manage their account. |
| **Field staff** | Work public reports: mark *in progress* and *resolved*. Can be limited to certain categories. Never sees hidden reports or reporter identities. |
| **Moderator** | Review reports: put under review, hide or restore, reject (with reason), mark duplicate. Sees reporters and the overview. |
| **Administrator** | Everything above, plus users, roles and permissions, the audit log and the System page. |

Guards against privilege escalation: nobody can grant, create or act on access they do not hold themselves (a user manager cannot hand out the Administrator role or reset an administrator's password); built-in roles are fixed; nobody can edit or disable the role they hold; the last active administrator cannot be demoted or disabled. Role changes and disabled roles take effect on the next request.

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
- `SEED_DEMO_ACCOUNTS=true` creates one test account per built-in role on a **local** deployment only (see [docs/testing-accounts.md](docs/testing-accounts.md)).
- `SEED_DEMO=true` (the seed script) adds sample reports, attributed to sample accounts with random, unpublished passwords.

Pages: `/admin` (work queue), `/admin/overview` (charts), `/admin/users`, `/admin/roles`, `/admin/audit`, `/admin/system` (service health, email test, exact OAuth redirect URIs), `/account`, `/forgot-password`, and the `/privacy`, `/terms`, `/data-deletion` pages that Google and Facebook require for app review.

## API

All endpoints are under `/api/v1`. Errors are `{ "error": string }` (validation errors add `issues`).

**Public**
- `GET /categories`
- `GET /reports?bbox=minLng,minLat,maxLng,maxLat&status=verified,under_review,in_progress,resolved&category=roads&limit=500` — public reports only
- `GET /reports/:id` — public unless hidden, rejected, duplicate, withdrawn or awaiting review; those only for the owner and roles with `reports.view_private`
- `GET /media/:name` — report photos (same visibility rules as the report)

**Auth**
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`
- `GET /auth/oauth/:provider` (start) and `GET /auth/oauth/:provider/callback` — browser redirects, not JSON

**Citizen** (logged in)
- `POST /reports` — `multipart/form-data` (`title`, `description`, `categorySlug`, `lat`, `lng`, `barangay?`, `address?`, `photos` ×3) or JSON
- `GET /me/reports`
- `PATCH /reports/:id` — edit until work starts (`verified`, `under_review`, `submitted`); every edit is audited
- `DELETE /reports/:id` — withdraw until work starts

**Admin**
- `GET /admin/reports?status=verified` — work queue (`reports.review` or `reports.work`)
- `POST /admin/reports/:id/transition` — `{ "to": "hidden", "note"?, "duplicateOf"? }`; `note` required for `hidden` and `rejected`
- `GET /admin/roles`, `POST /admin/roles`, `PATCH /admin/roles/:key` — roles and permissions (`roles.manage`; listing also `users.manage`)
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

## Further documentation

- [docs/architecture.md](docs/architecture.md): components, trust boundaries, data flow
- [docs/security.md](docs/security.md): sessions, passwords, rate limits, headers, known limitations
- [docs/operations.md](docs/operations.md): deploy and rollback, migrations, backups and restore, incidents
- [docs/claude-audit-report.md](docs/claude-audit-report.md): November 2026 full-stack audit
- [docs/testing.md](docs/testing.md): unit and end-to-end tests, running them locally and in CI
- [docs/testing-accounts.md](docs/testing-accounts.md): test accounts for every role (development only)
- [docs/roles-and-permissions.md](docs/roles-and-permissions.md): permissions, built-in and custom roles, escalation guards
- [docs/mailpit.md](docs/mailpit.md): development email with Mailpit; email vs in-app notifications
- [docs/map-tiles.md](docs/map-tiles.md): basemap provider evaluation and configuration
- [docs/additional-enhancements-report.md](docs/additional-enhancements-report.md): November 2026 additions (this round)
- [docs/frontend-enhancement-report.md](docs/frontend-enhancement-report.md): design system (tokens, components in `components/ui/`), accessibility and UI changes

## Notes

- Rate limits (Redis): 5 sign-ups/hour/IP, login attempts per IP and per email, 10 reports/hour/user, 20 feedback/follow-up entries/hour/user.
- The barangay field suggests the 46 barangays of Sipocot but accepts any text.
- Photos default to local disk. Running more than one app instance? Use `STORAGE_DRIVER=s3`. Existing local photos are not migrated automatically; copy the files in `UPLOAD_DIR` into the bucket under the same names.
