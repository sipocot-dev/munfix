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
| Browser → API | JSON and multipart bodies, query strings, cookies | zod schemas (`lib/validation.ts`), `requireUser` / `requirePermission` (`lib/api.ts`), Origin check on writes, rate limits (`lib/rate-limit.ts`) |
| Browser → media | `/api/v1/media/<uuid>.<ext>` | Strict filename pattern; `canViewMedia` serves photos of unpublished reports only to the owner, moderators and admins |
| Uploads → storage | File bytes | Type is decided by magic bytes, never by the client; at most 3 files of 5 MB; names are server-generated UUIDs |
| App → Postgres | SQL | Parameterised queries only; identifiers (`DATABASE_SCHEMA`) are checked against a strict pattern |
| App → Redis | Session JSON keyed by SHA-256 of the token | Redis holds no raw tokens; when Redis is down, nobody is signed in (sessions fail closed) and rate limits fail open |
| OAuth provider → app | Authorization code, profile | `state` cookie compared in constant time; only Google's verified email links to an existing account |
| Vercel Cron → app | `Authorization: Bearer $CRON_SECRET` | Constant-time compare; closed when the secret is unset |
| Edge → app | `X-Real-IP`, `X-Forwarded-For` | `clientIp()` trusts `X-Real-IP` (set by Vercel), else the last forwarded hop |

## Roles and permissions

Authorization is permission-based ([roles-and-permissions.md](roles-and-permissions.md)). The session in Redis stores the user and their role key; `getSession()` resolves the role's current permissions from the `roles` table on every request, so editing or disabling a role applies at once. Built-in roles (citizen, staff, moderator, admin) are defined in `lib/permissions.ts`; custom roles are data. A session holding a temporary password, or whose role is disabled, has no permissions. Changing a user's role, deactivating them or resetting their password also revokes all of their sessions.

## Report lifecycle

A report is published as soon as it is submitted (`verified`, labelled "Published"). Moderators can put a public report `under_review` (still public), `hidden` (private, reversible, reason required), `rejected` (final, reason required) or `duplicate`; field staff move it to `in_progress` and `resolved` (`lib/status.ts`). Public = `verified`, `under_review`, `in_progress`, `resolved`; the public timeline shows only events after publication. The status change, its `report_events` audit row and the reporter's email (`email_outbox`) are written in one transaction. Reporter edits are audited as `edited` events.
