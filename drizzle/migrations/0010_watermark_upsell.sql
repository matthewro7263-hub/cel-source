-- CEL-MON-002: watermark upsell columns
-- Safe to run multiple times (IF NOT EXISTS guards each column).

DO $$ BEGIN
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS watermark_removed boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS watermark_stripe_session_id text;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
