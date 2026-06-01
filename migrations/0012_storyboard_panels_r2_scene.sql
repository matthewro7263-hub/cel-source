-- Migration 0012: Add r2_key, scene_id, and make image_data nullable on storyboard_panels
-- Generated manually; run `drizzle-kit generate` locally to sync meta

-- === add r2_key column to storyboard_panels ===
ALTER TABLE "storyboard_panels" ADD COLUMN IF NOT EXISTS "r2_key" text;

-- === add scene_id column to storyboard_panels ===
ALTER TABLE "storyboard_panels" ADD COLUMN IF NOT EXISTS "scene_id" integer;

-- === make image_data nullable on storyboard_panels ===
ALTER TABLE "storyboard_panels" ALTER COLUMN "image_data" DROP NOT NULL;

-- === Foreign key index for scene_id ===
CREATE INDEX IF NOT EXISTS "panels_scene_id_idx" ON "storyboard_panels" ("scene_id");
