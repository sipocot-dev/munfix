-- MunFix initial schema

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  name          text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE categories (
  id          smallserial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  sort_order  smallint NOT NULL DEFAULT 0
);

CREATE TABLE reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  category_id  smallint NOT NULL REFERENCES categories (id),
  title        text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  description  text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  lat          double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng          double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  address      text,
  barangay     text,
  status       text NOT NULL DEFAULT 'submitted' CHECK (status IN (
                 'submitted', 'under_review', 'verified', 'in_progress',
                 'resolved', 'rejected', 'duplicate', 'withdrawn')),
  duplicate_of uuid REFERENCES reports (id) ON DELETE SET NULL,
  published_at timestamptz,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_status_created_idx ON reports (status, created_at DESC);
CREATE INDEX reports_user_idx ON reports (user_id, created_at DESC);
CREATE INDEX reports_geo_idx ON reports (lng, lat);
CREATE INDEX reports_category_idx ON reports (category_id);

CREATE TABLE report_media (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  uuid NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  path       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_media_report_idx ON report_media (report_id, created_at);

-- Status history. Doubles as the public timeline and the admin audit log.
CREATE TABLE report_events (
  id          bigserial PRIMARY KEY,
  report_id   uuid NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  from_status text,
  to_status   text NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_events_report_idx ON report_events (report_id, created_at);
CREATE INDEX report_events_created_idx ON report_events (created_at DESC);
