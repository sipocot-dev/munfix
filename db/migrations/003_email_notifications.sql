-- Email notifications to reporters when their report changes status.

-- Citizens can opt out from "My reports".
ALTER TABLE users ADD COLUMN email_notifications boolean NOT NULL DEFAULT true;

-- Transactional outbox: a row is written in the same transaction as the status
-- change, so a notification is never lost if the mail server is down. A worker
-- sends pending rows and retries failures with exponential backoff.
CREATE TABLE email_outbox (
  id              bigserial PRIMARY KEY,
  user_id         uuid REFERENCES users (id) ON DELETE SET NULL,
  report_id       uuid REFERENCES reports (id) ON DELETE SET NULL,
  to_email        text NOT NULL,
  subject         text NOT NULL,
  text_body       text NOT NULL,
  html_body       text NOT NULL,
  attempts        smallint NOT NULL DEFAULT 0,
  last_error      text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_outbox_pending_idx ON email_outbox (next_attempt_at) WHERE sent_at IS NULL;
