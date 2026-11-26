# Test accounts (development and testing only)

> **These credentials are public and for local development and CI only.** They are created only when the
> app's `APP_URL` is `localhost` or `127.0.0.1`, and the login refuses them on any other deployment, even
> if the rows exist in its database. Never use these addresses or this password for real people, and never
> put real credentials in this file.

## Accounts

Log in at **<http://localhost:3000/login>** (or the port you run on). Password for all four:
**`demo-password`** (override with `DEMO_PASSWORD` in your `.env`).

| Role | Email | What you can test |
| --- | --- | --- |
| Citizen | `demo.citizen@munfix.local` | Submit reports (published at once), see the map and list, edit or withdraw your own report until work starts, feedback and follow-ups, My reports, account settings, email preference, theme |
| Field staff | `demo.staff@munfix.local` | Work queue (`/admin`): mark public reports *in progress* and *resolved* with a note. Cannot hide, reject or see who reported. Can be limited to categories on Admin → Users |
| Moderator | `demo.moderator@munfix.local` | Work queue with all stages: put under review, hide (reason required), restore, reject (reason required), mark duplicate; see reporters and hidden reports; Overview |
| Administrator | `demo.admin@munfix.local` | Everything: Users, Roles and permissions, Audit log, System (service health, test email), plus all of the above |

Permissions per role (the server's source of truth is `SYSTEM_ROLES` in `lib/permissions.ts`):

| Permission | Citizen | Field staff | Moderator | Administrator |
| --- | :-: | :-: | :-: | :-: |
| `reports.work` (in progress / resolved) | | ✓ | | ✓ |
| `reports.review` (under review, hide, restore, reject, duplicate) | | | ✓ | ✓ |
| `reports.view_private` (hidden and other non-public reports) | | | ✓ | ✓ |
| `reports.view_reporter` (reporter name and email) | | | ✓ | ✓ |
| `stats.view` (Overview) | | | ✓ | ✓ |
| `audit.view`, `system.view` | | | | ✓ |
| `users.manage`, `roles.manage` | | | | ✓ |

Every signed-in account, staff included, can also report problems and manage their own account.

## Emails sent to these accounts

With `npm run services:up`, every email goes to **Mailpit**: open <http://localhost:8025>. The `@munfix.local` addresses are not real mailboxes; nothing leaves your machine.

## Create, reset or remove

The accounts are created, and reset to a known state (role, active, password, no forced password change), every time the app starts or the seed runs, when both are true:

- `SEED_DEMO_ACCOUNTS=true` (the default in `.env.example` and in the Docker Compose `full` profile), and
- `APP_URL` is `http://localhost:…` or `http://127.0.0.1:…`.

```bash
# reset them now (also restores a changed password, role or deactivation)
npm run db:seed

# fresh database including sample reports
npm run services:down && docker volume rm munfix_pgdata && npm run services:up
npm run db:migrate && SEED_DEMO=true npm run db:seed
```

To stop creating them, set `SEED_DEMO_ACCOUNTS=false`. To remove existing ones, deactivate them on **Admin → Users** (Admin → System lists any that exist).

## Why they cannot reach production

- `lib/setup.ts` refuses to create them unless `isLocalEnvironment()` (in `lib/env.ts`) is true: `APP_URL` must be a localhost address, and a Vercel production deployment (`VERCEL_ENV=production`) never counts as local.
- `POST /api/v1/auth/login` rejects these four addresses on non-local deployments with the same "Incorrect email or password" answer as a wrong password.
- Both rules are covered by unit tests (`tests/unit/uploads-and-routes.test.ts`).

The production administrator is separate: it comes from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (12+ characters required in production, must be changed at first login) or `npm run admin:create`.
