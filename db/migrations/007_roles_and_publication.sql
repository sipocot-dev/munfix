-- 1. Roles become data. Each role is a set of permissions (see lib/permissions.ts for the catalogue).
--    The four built-in roles reproduce the earlier hard-coded behaviour and are kept in sync on every
--    start by lib/setup.ts; administrators can add their own roles alongside them.
CREATE TABLE roles (
  key         text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9-]{1,39}$'),
  name        text NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 2 AND 60),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  permissions text[] NOT NULL DEFAULT '{}',
  is_system   boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO roles (key, name, description, permissions, is_system) VALUES
  ('citizen', 'Citizen', '', '{}', true),
  ('staff', 'Field staff', '', '{reports.work}', true),
  ('moderator', 'Moderator', '', '{reports.review,reports.view_private,reports.view_reporter,stats.view}', true),
  ('admin', 'Administrator', '',
   '{reports.review,reports.view_private,reports.view_reporter,reports.work,stats.view,audit.view,system.view,users.manage,roles.manage}', true);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_fkey FOREIGN KEY (role) REFERENCES roles (key);

-- 2. Reports are published as soon as they are submitted, and moderators can hide them.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK (status IN (
  'submitted', 'under_review', 'verified', 'in_progress', 'resolved', 'rejected', 'duplicate', 'withdrawn', 'hidden'));
ALTER TABLE reports ALTER COLUMN status SET DEFAULT 'verified';

-- "Under review" used to mean "not published yet"; it now means "public, and being checked".
-- Reports that were waiting for their first review were filed under the promise that staff check them
-- before anyone sees them, so they are not published retroactively: they move to "submitted", which
-- stays private until a moderator publishes, hides or rejects them.
UPDATE reports SET status = 'submitted' WHERE status = 'under_review' AND published_at IS NULL;
