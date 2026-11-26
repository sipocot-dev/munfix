# Architecture and trust boundaries

## Components

```
Browser ──HTTPS──> Cloudflare (proxy) ──> Vercel (Next.js 15 App Router, Node runtime)
                                             │
                     ┌───────────────────────┼─────────────────────────┬───────────────┐
                     ▼                       ▼                         ▼               ▼
              PostgreSQL 16           Redis                      S3-compatible     SMTP
              schema `munfix`         sessions, rate limits,     bucket (photos)   (email outbox)
              (all durable data)      read-through cache
```

- **Pages** (`app/**/page.tsx`) are server components that read the database directly through `lib/*`. Every page is dynamic (`force-dynamic`), because each one reads the session cookie.
- **API** (`app/api/v1/**/route.ts`) is the only write path. Every handler is wrapped in `route()` (`lib/api.ts`), which checks the request origin on writes, maps `HttpError` and zod errors to JSON, and logs anything else with a request id.
- **Map tiles** come straight from the tile server in `NEXT_PUBLIC_MAP_TILE_URL` to the browser. The MapLibre worker is served from `public/`.
- **Background work**: on a long-running server, `instrumentation.ts` runs migrations at boot and starts the email worker. On Vercel, an `after()` callback sends mail right after the request that queued it, and Vercel Cron calls `/api/cron/mail` daily to retry and clean up.

## Trust boundaries

| Boundary | What crosses it | Control |
| --- | --- | --- |
| Browser → API | JSON and multipart bodies, query strings, cookies | zod schemas (`lib/validation.ts`), `requireUser` / `requireRole` (`lib/api.ts`), Origin check on writes, rate limits (`lib/rate-limit.ts`) |
| Browser → media | `/api/v1/media/<uuid>.<ext>` | Strict filename pattern; `canViewMedia` serves photos of unpublished reports only to the owner, moderators and admins |
| Uploads → storage | File bytes | Type is decided by magic bytes, never by the client; at most 3 files of 5 MB; names are server-generated UUIDs |
| App → Postgres | SQL | Parameterised queries only; identifiers (`DATABASE_SCHEMA`) are checked against a strict pattern |
| App → Redis | Session JSON keyed by SHA-256 of the token | Redis holds no raw tokens; when Redis is down, nobody is signed in (sessions fail closed) and rate limits fail open |
| OAuth provider → app | Authorization code, profile | `state` cookie compared in constant time; only Google's verified email links to an existing account |
| Vercel Cron → app | `Authorization: Bearer $CRON_SECRET` | Constant-time compare; closed when the secret is unset |
| Edge → app | `X-Real-IP`, `X-Forwarded-For` | `clientIp()` trusts `X-Real-IP` (set by Vercel), else the last forwarded hop |

## Roles

`citizen`, `moderator`, `staff` (field staff, optionally limited to categories) and `admin`. The rules live in `lib/permissions.ts` and are enforced on the server in `lib/reports.ts` and `lib/users.ts`. A session that still holds a temporary password counts as a citizen until the password is changed. The role is copied into the session. Changing a role, deactivating an account or resetting a password revokes all of that user's sessions.

## Report lifecycle

`submitted → under_review → verified (public) → in_progress → resolved`, with `rejected`, `duplicate` and `withdrawn` as end states (`lib/status.ts`). The status change, its `report_events` audit row and the reporter's email (`email_outbox`) are written in one transaction.
