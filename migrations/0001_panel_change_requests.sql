-- Panel Change Requests
-- Additive migration: safe to run on existing databases.
-- All new columns are nullable or have defaults; no existing rows are affected.

CREATE TABLE IF NOT EXISTS panel_change_requests (
  id         SERIAL PRIMARY KEY,
  panel_id   INTEGER NOT NULL,   -- references storyboard_panels(id)
  pin_id     INTEGER,            -- optional reference to panel_pins(id)
  author_id  INTEGER NOT NULL,   -- references users(id)
  body       TEXT    NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_panel_change_requests_panel_id
  ON panel_change_requests (panel_id);

CREATE INDEX IF NOT EXISTS idx_panel_change_requests_author_id
  ON panel_change_requests (author_id);
