# Operations

## Deploy

Production runs on Vercel behind Cloudflare. A merge to `main` deploys.

Before merging:

1. CI is green (typecheck, tests, `npm audit`, build).
2. If the PR adds a file under `db/migrations/`, read it. Migrations run automatically on the first request after deploy (`AUTO_SETUP`), inside a transaction and under an advisory lock. They are **forward-only**: there are no down migrations, so a migration must keep working with the previous app version (add columns or tables; don't rename or drop in the same release).
3. If the PR changes `NEXT_PUBLIC_*` usage, the values are inlined at build time; redeploy after changing them.

After deploy:

1. `GET /api/health` returns `{"status":"ok"}`, with `database`, `migrations` and `redis` all `ok`.
2. Load `/`, open one report, and open `/login`.
3. Check Vercel runtime logs for `"level":"error"` lines in the first few minutes.

### Migration 007 (roles and automatic publication)

Additive and safe to run on the live database: it creates `roles` with the four built-in roles, replaces the `users.role` check with a foreign key, adds the `hidden` status and makes `verified` the default status for new reports. Reports that were still waiting for their first review (`under_review` and never published) are moved to `submitted`, which stays private until a moderator publishes, hides or rejects them; nothing becomes public retroactively. Rolling the code back leaves the extra table and status harmless, but reports created while the new code ran are already public, and any report a moderator hid has status `hidden`, which the old code does not know: it stays private (the old code treats unknown statuses as not public), but the old work queue and report page may error on those reports. Before rolling back, restore hidden reports you want public, or reject them.

## Rollback

- **Code:** in Vercel → Deployments, "Instant Rollback" (or promote the previous deployment). This does not touch the database.
- **Schema:** because migrations are additive, the previous deployment keeps working against the newer schema. Never hand-edit `schema_migrations`. If a migration must be undone, write a new forward migration.
- **Data:** restore from backup (below) into a new database and switch `DATABASE_URL`. Never restore over the live database.

## Backups

`.github/workflows/backup.yml` runs every night (02:17 Asia/Manila). It dumps the `munfix` schema with `pg_dump`, checks the archive (`gzip -t`, the "dump complete" trailer, and the presence of `schema_migrations`), then uploads it to `s3://$BACKUP_S3_BUCKET/backups/`.

Set these in the GitHub repository:

- Secrets: `DATABASE_URL` (the production connection string), `BACKUP_AWS_ACCESS_KEY_ID`, `BACKUP_AWS_SECRET_ACCESS_KEY`
- Variables: `BACKUP_S3_BUCKET`, `BACKUP_S3_REGION`, and `BACKUP_S3_ENDPOINT` if the bucket is not AWS S3 (for example Cloudflare R2)

Run it once by hand from the Actions tab (workflow_dispatch) to confirm it works.

Operator actions that the workflow cannot do:

- **Retention:** add a lifecycle rule on `backups/` (for example, delete after 30 days). The workflow never deletes.
- **Encryption:** dumps contain names, emails and password hashes. Turn on bucket default encryption, and keep the bucket private with a key that can only write to `backups/`. On AWS, prefer OIDC (`aws-actions/configure-aws-credentials` with a role) over long-lived keys. R2 has no GitHub OIDC, so keep scoped keys there and rotate them.
- **Alerts:** a failed scheduled run only emails the workflow's last editor. Watch the Actions tab, or add a notification step.
- **Photos are not in the dump.** They live in the `S3_BUCKET` photo bucket. Turn on object versioning there, or replicate it, so a deleted or overwritten photo can be recovered.
- **Postgres version:** the workflow installs `pg_dump` 16. If the production server is upgraded past 16, raise the client version too (pg_dump refuses newer servers).

### Restore (and quarterly restore drill)

Always restore into a **new, empty** database, never into production.

```bash
aws s3 cp s3://$BACKUP_S3_BUCKET/backups/<file>.sql.gz . [--endpoint-url $BACKUP_S3_ENDPOINT]
gzip -t <file>.sql.gz
createdb munfix_restore            # or create a scratch database at your provider
gunzip -c <file>.sql.gz | psql --set ON_ERROR_STOP=1 "$RESTORE_DATABASE_URL"
psql "$RESTORE_DATABASE_URL" -c "SELECT name FROM munfix.schema_migrations ORDER BY name" \
                             -c "SELECT count(*) FROM munfix.users" -c "SELECT count(*) FROM munfix.reports"
```

The dump uses `--no-owner --no-privileges`: objects belong to whoever runs `psql`, and no grants are restored. The app only needs its own login role, with ownership of the `munfix` schema. To check the restore with the app, run it locally with `DATABASE_URL=$RESTORE_DATABASE_URL AUTO_SETUP=false`, then open `/api/health`, which should say `migrations: ok`.

Write down the date, the file, the row counts and how long the restore took. Do this drill every quarter.

## Redis

Redis holds only sessions, rate-limit counters and a 60-second read cache. Losing it signs everyone out and resets the limits; no report data is lost. While Redis is unreachable, nobody can sign in (`/api/health` shows `redis: error`), public pages still load, and rate limits are off.

## Incident response

1. Check `/api/health` and the Vercel runtime logs. Errors are JSON lines with a `requestId` or `digest`, which users see as "Reference".
2. **Suspected account compromise:** on Admin → Users, deactivate the account, or reset its password. Either one revokes all of its sessions at once.
3. **Leaked secret:** rotate it at the provider, update the Vercel environment variable, and redeploy. For `CRON_SECRET`, also update Vercel Cron (it reads the env var). To sign everyone out, flush the `sess:*` and `usess:*` keys in Redis.
4. **Inappropriate published report:** a moderator or admin moves it to `rejected` with a reason. Its photos become private at once; shared caches may keep a public copy for up to 5 minutes (`Cache-Control: public, max-age=300`). Purge Cloudflare's cache for `/api/v1/media/*` if that matters.

## Dependency scanning

- CI runs `npm audit --omit=dev --audit-level=high` and fails on high or critical production advisories.
- Dependabot opens weekly update PRs for npm packages and GitHub Actions. Major npm upgrades are skipped (`.github/dependabot.yml`); upgrade those by hand.
