-- Social sign-in. Accounts created through a provider have no password.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE oauth_accounts (
  provider            text NOT NULL CHECK (provider IN ('google', 'facebook')),
  provider_account_id text NOT NULL,
  user_id             uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_account_id)
);
CREATE INDEX oauth_accounts_user_idx ON oauth_accounts (user_id);
