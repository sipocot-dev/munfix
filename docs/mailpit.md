# Email in development: Mailpit

[Mailpit](https://mailpit.axllent.org/) catches every email the app sends during development and shows it in a web inbox. Nothing is delivered to real addresses.

## Use it

```bash
npm run services:up        # starts Postgres, Redis and Mailpit
```

| | Address |
| --- | --- |
| Web inbox | <http://localhost:8025> |
| SMTP (for the app) | `localhost:1025`, no TLS, no login |
| API (used by the end-to-end tests) | `http://localhost:8025/api/v1/…` |

`.env.example` already points the app at it:

```bash
SMTP_HOST=localhost
SMTP_PORT=1025
```

In the Docker Compose `full` profile the app container uses `SMTP_HOST=mailpit`, `SMTP_PORT=1025` by default. Both ports are bound to `127.0.0.1`, so Mailpit is not reachable from other machines.

## What sends email

| Trigger | Recipient | Subject starts with |
| --- | --- | --- |
| A report is submitted (published) | Reporter | "Your report is on the public map" |
| A moderator puts it under review | Reporter | "A moderator is checking your report" |
| A moderator hides it (with the reason) | Reporter | "Your report was hidden" |
| A hidden report is restored | Reporter | "Your report is visible again" |
| Work starts / is resolved / is reopened | Reporter | "Work has started…", "Your report was resolved", "Your report was reopened" |
| Rejected (with reason) / marked duplicate | Reporter | "Your report could not be accepted", "Your report matches an existing one" |
| Forgot password | The account | "Reset your password" |
| Admin → System → Send test email | The administrator | "Test email" |

Reporters who turned email updates off get no status emails. **Registration sends no email**: accounts are not email-verified (an open product decision, see the audit report O1). Withdrawing a report sends nothing.

To try it: log in as `demo.citizen@munfix.local` (see [testing-accounts.md](testing-accounts.md)), submit a report, and open <http://localhost:8025>. Then log in as the moderator, hide the report with a reason, and watch the second email arrive.

## Email notifications vs in-app notifications

MunFix sends **email notifications only**. There are **no in-app notifications**: no bell icon, unread counter or notification inbox inside the app. The "Email updates" switch on My reports and Account settings controls email only. Mailpit is a development tool for inspecting those emails; it is not a notification system and it is not part of production.

Building in-app notifications would need backend work: a `notifications` table written in the same transaction as each status change (like the existing `email_outbox`), an API to list and mark them read, and a UI.

## Production

Production uses a real SMTP provider configured through the hosting environment (`SMTP_URL`, or `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`, and `MAIL_FROM`). Never deploy Mailpit or point a production app at it. Development values live in your local `.env` (git-ignored), so they cannot leak into production settings.
