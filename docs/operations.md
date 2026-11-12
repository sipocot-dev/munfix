# Operations

## Backups

`.github/workflows/backup.yml` runs every night (02:17 Asia/Manila) and uploads a gzipped SQL dump of the `munfix` schema to `s3://$BACKUP_S3_BUCKET/backups/`.

Set these in the GitHub repository:

- Secrets: `DATABASE_URL` (the production connection string), `BACKUP_AWS_ACCESS_KEY_ID`, `BACKUP_AWS_SECRET_ACCESS_KEY`
- Variables: `BACKUP_S3_BUCKET`, `BACKUP_S3_REGION`, and `BACKUP_S3_ENDPOINT` if the bucket is not AWS S3 (for example Cloudflare R2)

Run it once by hand from the Actions tab (workflow_dispatch) to confirm it works.

Add a lifecycle rule on the backup prefix to delete objects older than your retention window (for example 30 days). The workflow does not delete old dumps.

### Restore

```bash
aws s3 cp s3://$BACKUP_S3_BUCKET/backups/<file>.sql.gz .
# Restore into an empty database (the schema is recreated by the dump):
gunzip -c <file>.sql.gz | psql "$TARGET_DATABASE_URL"
```

Restore into a scratch database first and check the row counts before pointing the app at it.

## Dependency scanning

- CI runs `npm audit --omit=dev --audit-level=high` and fails on high or critical production advisories.
- Dependabot opens weekly update PRs for npm packages and GitHub Actions.
