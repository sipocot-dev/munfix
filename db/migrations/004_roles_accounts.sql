-- Roles, account management and password reset.

-- citizen: reports problems. moderator: reviews and publishes new reports.
-- staff: field/department crews who move published reports to in progress / resolved.
-- admin: everything, including user management.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('citizen', 'moderator', 'staff', 'admin'));

ALTER TABLE users ADD COLUMN is_active            boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN last_login_at        timestamptz;
ALTER TABLE users ADD COLUMN password_changed_at  timestamptz;
ALTER TABLE users ADD COLUMN deleted_at           timestamptz;

-- Existing administrator accounts were created from a seed password that may be a
-- well-known default. Make each one choose a new password at their next login.
UPDATE users SET must_change_password = true WHERE role = 'admin' AND password_hash IS NOT NULL;

-- Optional scope for field staff: which categories they work on.
-- A staff user with no rows here can act on every category.
CREATE TABLE user_categories (
  user_id     uuid     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category_id smallint NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, category_id)
);

-- Account-level audit trail (report status changes live in report_events).
CREATE TABLE admin_actions (
  id             bigserial PRIMARY KEY,
  actor_id       uuid REFERENCES users (id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  action         text NOT NULL,
  detail         jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_actions_created_idx ON admin_actions (created_at DESC);

-- Single-use password reset tokens. Only a hash of the token is stored.
CREATE TABLE password_resets (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_idx ON password_resets (user_id);
