// Idempotent schema: safe to run on every cold start.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS bugs (
  id               SERIAL PRIMARY KEY,
  key              TEXT UNIQUE,
  summary          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'Open',
  component        TEXT NOT NULL,
  affects_version  TEXT NOT NULL,
  fix_version      TEXT NOT NULL DEFAULT 'None',
  security_level   TEXT NOT NULL DEFAULT 'Leads and Reporter only',
  type             TEXT NOT NULL DEFAULT 'Bug',
  priority         TEXT NOT NULL DEFAULT 'Major',
  reporter         TEXT NOT NULL,
  assignee         TEXT NOT NULL DEFAULT 'Unassigned',
  resolution       TEXT NOT NULL DEFAULT 'Unresolved',
  labels           TEXT NOT NULL DEFAULT 'None',
  environment      TEXT NOT NULL,
  severity         TEXT NOT NULL,
  error_type       TEXT NOT NULL,
  precondition     TEXT NOT NULL DEFAULT '',
  steps            JSONB NOT NULL DEFAULT '[]',
  actual           TEXT NOT NULL,
  expected         TEXT NOT NULL,
  note             TEXT NOT NULL DEFAULT '',
  suggested_severity TEXT,
  quality_score    INT NOT NULL DEFAULT 0,
  quality_grade    TEXT NOT NULL DEFAULT 'F',
  planted_id       TEXT,
  severity_verdict TEXT,
  duplicate_of     TEXT,
  run_id           INT,
  check_id         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bug_history (
  id      SERIAL PRIMARY KEY,
  bug_id  INT NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  actor   TEXT NOT NULL,
  role    TEXT NOT NULL,
  field   TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason  TEXT,
  at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS comments (
  id      SERIAL PRIMARY KEY,
  bug_id  INT NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  author  TEXT NOT NULL,
  role    TEXT NOT NULL,
  body    TEXT NOT NULL,
  at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS test_runs (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  target      TEXT NOT NULL,
  checklists  JSONB NOT NULL,
  tester      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Not started',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS run_results (
  run_id   INT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  check_id TEXT NOT NULL,
  result   TEXT NOT NULL,
  note     TEXT NOT NULL DEFAULT '',
  bug_key  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, check_id)
);
CREATE TABLE IF NOT EXISTS shop_accounts (
  id       SERIAL PRIMARY KEY,
  session  TEXT NOT NULL,
  name     TEXT NOT NULL,
  email    TEXT NOT NULL,
  phone    TEXT NOT NULL,
  city     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shop_orders (
  id       SERIAL PRIMARY KEY,
  session  TEXT NOT NULL,
  items    JSONB NOT NULL,
  total    NUMERIC(10,2) NOT NULL,
  city     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shop_reviews (
  id       SERIAL PRIMARY KEY,
  session  TEXT NOT NULL,
  author   TEXT NOT NULL,
  rating   INT NOT NULL,
  body     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
CREATE INDEX IF NOT EXISTS bugs_reporter_idx ON bugs(reporter);
CREATE INDEX IF NOT EXISTS shop_accounts_session_idx ON shop_accounts(session);
`;
