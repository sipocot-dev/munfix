-- CitiFix-style "problem types": each category has a short list of specific problems
-- (for example Roads -> Pothole, Cracked road) so reports are easier to triage and count.
CREATE TABLE problem_types (
  id          serial PRIMARY KEY,
  category_id smallint NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  slug        text NOT NULL,
  name        text NOT NULL,
  sort_order  smallint NOT NULL DEFAULT 0,
  UNIQUE (category_id, slug)
);

-- Nullable: reports filed before this migration, and categories without types, have none.
ALTER TABLE reports ADD COLUMN problem_type_id integer REFERENCES problem_types (id) ON DELETE SET NULL;
CREATE INDEX reports_problem_type_idx ON reports (problem_type_id);
