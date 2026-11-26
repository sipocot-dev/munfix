# Testing

| Layer | Tool | Where | Needs |
| --- | --- | --- | --- |
| Unit | Vitest | `tests/unit/` | Nothing: Postgres and Redis are mocked |
| End-to-end | Playwright | `e2e/` | A production build, Postgres, Redis, Mailpit (for the email tests) |
| Accessibility | axe-core via Playwright | `e2e/a11y.spec.ts` | Same as end-to-end |

## Unit tests

```bash
npm test            # or npm run test:watch
```

They cover the permission matrix and escalation guards (`roles.test.ts`, `permissions.test.ts`, `report-access.test.ts`), the publication and moderation state machine, uploads, redirects, rate limits, contrast of every theme token, and the map-marker CSS invariant.

## End-to-end tests

```bash
npm run services:up                     # Postgres, Redis, Mailpit (docker compose)
cp .env.example .env                    # if you have not already: local URLs, Mailpit SMTP, test accounts on
npm run build
npm run db:migrate
SEED_DEMO=true npm run db:seed          # roles, test accounts and sample reports
npm run test:e2e                        # starts the app on port 3200 and runs every project
npx playwright test --project=desktop   # one project
npx playwright test e2e/map.spec.ts     # one file
npm run test:e2e:ui                     # interactive runner
```

The first time, install a browser: `npx playwright install chromium` (add `firefox webkit` for the cross-browser projects).

Environment variables the tests read: `E2E_PORT` (default 3200), `E2E_BASE_URL`, `MAILPIT_URL` (default `http://localhost:8025`), `DEMO_PASSWORD`, `REDIS_URL`. `APP_URL` in `.env` must be a localhost URL (any port), or the test accounts are not created.

### Projects and tags

| Project | Viewport | Runs |
| --- | --- | --- |
| `setup` | — | Signs in once per role and saves the sessions (`e2e/.auth/`), and resets the test Redis's rate-limit counters |
| `desktop` | 1440×900 Chromium | Every test |
| `tablet` | 820×1180 Chromium, touch | Tests tagged `@responsive` |
| `mobile` | Pixel 7 | Tests tagged `@responsive` or `@mobile` |
| `firefox`, `webkit-mobile` | Firefox 1280×800, iPhone 14 | Tests tagged `@cross-browser`; only with `E2E_ALL_BROWSERS=1` (CI sets it) |

Tests that change data run on desktop only, and create their own reports and accounts through the API, so they do not depend on each other.

### What is covered

- Every route: renders, one `h1`, landmarks, no console errors, no sideways scrolling (desktop, tablet, phone); the 404 page; the skip link.
- Authorization: every workspace page for every role (allowed = 200, otherwise 404 with no content); admin APIs refuse each role without the permission; cross-site writes are refused.
- Roles: creating a custom role in the UI, assigning it, enforcement on the API, disabling it, built-in and own-role locks, and the no-escalation rules for a user-manager role.
- Reports: submit with a photo (public at once, no personal data in the public API), validation, owner edit (audited) until work starts, withdraw via the dialog, My reports, follow-ups; moderators hide/restore/review/reject; field staff in progress/resolved (also on a phone); forbidden transitions.
- Map: clusters and pins keep their position on hover and focus, the cluster number stays centred, keyboard (Enter on a cluster zooms in), click and tap open the preview, the legend; the list's filters and search are kept in the URL.
- Theme: OS default, the chosen theme applied before first paint, persistence, System following the OS.
- Email (Mailpit): publication, hide reason, in progress, resolved with note, password reset link, and that registration sends nothing.
- Accessibility: axe-core WCAG 2.2 AA tags on 16 pages, light and dark, desktop and phone.

### When a test fails

Playwright keeps a trace and a screenshot for failed tests in `test-results/`. Open a trace with `npx playwright show-trace test-results/<test>/trace.zip`. In CI they are uploaded as the `playwright-report` artifact (with the HTML report) on failure.

## CI

`.github/workflows/ci.yml` has two jobs on every pull request:

- **check**: typecheck, unit tests, production dependency audit, build.
- **e2e**: Postgres 16, Redis 7 and Mailpit service containers; build; migrate; seed; all Playwright projects including Firefox and WebKit.

There is no linter configured in this repository (no ESLint config), so there is no lint step.
