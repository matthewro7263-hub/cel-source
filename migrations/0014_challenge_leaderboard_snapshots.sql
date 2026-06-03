-- Migration: add challenge_leaderboard_snapshots
-- Run with: npx drizzle-kit push   OR   psql $DATABASE_URL -f this-file.sql

CREATE TABLE IF NOT EXISTS challenge_leaderboard_snapshots (
  id               SERIAL PRIMARY KEY,
  week_number      INTEGER        NOT NULL,
  user_id          INTEGER        NOT NULL,
  submission_id    INTEGER        NOT NULL,
  rank             INTEGER        NOT NULL,
  total_reactions  INTEGER        NOT NULL DEFAULT 0,
  top_sticker      TEXT,
  snapshot_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Keep snapshots queryable without a full-table scan
CREATE INDEX IF NOT EXISTS idx_cls_week
  ON challenge_leaderboard_snapshots (week_number, rank);
