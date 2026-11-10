# MunFix · Iligan City

A civic reporting platform for Iligan City that enables citizens to report infrastructure issues, view them on a map, and track resolution progress.

Inspired by [CitiFix / BetterIligan](https://github.com/KishonShrill/CitiFix), rebuilt on **Next.js + PostgreSQL + Redis** with no third-party services required: photos are stored on disk, sessions live in Redis, and the map uses open tiles.

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

## Configuration

See [`.env.example`](.env.example). The `NEXT_PUBLIC_*` values are inlined at build time:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `REDIS_URL` | Service connections |
| `APP_URL` | Public URL; `https://` marks session cookies `Secure` |
| `STORAGE_DRIVER` | `local` (default) or `s3` |
| `UPLOAD_DIR` | Photo directory for the `local` driver (use a persistent volume) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PREFIX` | `s3` driver settings. R2: `S3_REGION=auto` and its account endpoint. MinIO: `S3_FORCE_PATH_STYLE=true` |
| `OAUTH_GOOGLE_*`, `OAUTH_FACEBOOK_*` | `CLIENT_ID` / `CLIENT_SECRET` for social sign-in (see below) |
| `NEXT_PUBLIC_MAP_CENTER_*` | Initial map center (Iligan City by default) |
| `NEXT_PUBLIC_MAP_BOUNDS` | `minLng,minLat,maxLng,maxLat` — reports must be pinned inside this box |
| `NEXT_PUBLIC_MAP_TILE_URL` | Tile template. The public OSM server is for development only; use a tile provider in production |

The municipality is configuration, not code: change the name, province, center and bounds to deploy for another city.

## Social sign-in

Set `OAUTH_<PROVIDER>_CLIENT_ID` and `_CLIENT_SECRET` and the "Continue with Google/Facebook" button appears; leave them unset and the provider is hidden. Register this redirect URI with the provider (`APP_URL` must be the public URL):

```
<APP_URL>/api/v1/auth/oauth/google/callback
<APP_URL>/api/v1/auth/oauth/facebook/callback
```

- Google needs the `openid email profile` scopes; Facebook needs `email` and `public_profile`.
- A provider account that has never signed in creates a new citizen. Admin accounts are only created by the seed script.
- **Account linking:** a *verified* Google email that matches an existing account links to it. Facebook does not guarantee that the user owns an address, so a Facebook email that matches an existing account is refused (the user logs in with their password instead). This prevents account takeover.
- The flow uses a one-time `state` cookie for CSRF protection. Accounts created via a provider have no password.

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
app/                 Pages and API route handlers
  api/v1/            REST API
  admin/             Moderation queue and audit log
  reports/[id]/      Public report page with timeline
  report/new/        Submit a report
components/          Map, forms, moderation controls
lib/                 Database, Redis, sessions, caching, rate limits, report logic
db/migrations/       SQL migrations (applied in order, tracked in schema_migrations)
scripts/             migrate.ts and seed.ts
```

## Notes

- Rate limits (Redis): 5 sign-ups/hour/IP, login attempts per IP and per email, 10 reports/hour/user.
- The barangay field suggests Iligan City barangays but accepts any text.
- Photos default to local disk. Running more than one app instance? Use `STORAGE_DRIVER=s3`. Existing local photos are not migrated automatically; copy the files in `UPLOAD_DIR` into the bucket under the same names.
