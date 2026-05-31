-- Migration: 0010_speedrun_challenges
-- Adds speedrun columns to challenge_prompts.
-- Safe to run multiple times (IF NOT EXISTS guards).

ALTER TABLE challenge_prompts
  ADD COLUMN IF NOT EXISTS is_speedrun BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE challenge_prompts
  ADD COLUMN IF NOT EXISTS deadline_hours INTEGER;

-- Verify
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'challenge_prompts'
-- AND column_name IN ('is_speedrun', 'deadline_hours');
