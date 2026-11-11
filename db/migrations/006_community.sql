-- Feedback, follow-up requests and reopen are rows in the report log: report_events.kind says which.
ALTER TABLE report_events ADD COLUMN kind text NOT NULL DEFAULT 'status';

-- Points earned when a report is resolved (reporter and the person who resolved it).
CREATE TABLE point_awards (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  report_id  uuid NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  points     integer NOT NULL,
  reason     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, report_id, reason)
);
