-- Migration 0013: Add notes and change_request to storyboard_panels
-- Generated manually; run `drizzle-kit generate` locally to sync meta

-- === add notes column to storyboard_panels ===
ALTER TABLE "storyboard_panels" ADD COLUMN IF NOT EXISTS "notes" text NOT NULL DEFAULT '';

-- === add change_request column to storyboard_panels ===
ALTER TABLE "storyboard_panels" ADD COLUMN IF NOT EXISTS "change_request" text NOT NULL DEFAULT '';
