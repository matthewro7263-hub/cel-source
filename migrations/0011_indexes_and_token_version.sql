-- Migration 0011: Add foreign key indexes and tokenVersion to users
-- Generated manually; run `drizzle-kit generate` locally to sync meta

-- === tokenVersion column on users ===
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0;

-- === Foreign key indexes (resolves missing index strategy) ===

-- projects
CREATE INDEX IF NOT EXISTS "owner_id_idx" ON "projects" ("owner_id");

-- project_members
CREATE INDEX IF NOT EXISTS "pm_project_id_idx" ON "project_members" ("project_id");
CREATE INDEX IF NOT EXISTS "pm_user_id_idx" ON "project_members" ("user_id");

-- scripts
CREATE INDEX IF NOT EXISTS "scripts_project_id_idx" ON "scripts" ("project_id");

-- storyboards
CREATE INDEX IF NOT EXISTS "storyboards_project_id_idx" ON "storyboards" ("project_id");

-- storyboard_panels
CREATE INDEX IF NOT EXISTS "panels_storyboard_id_idx" ON "storyboard_panels" ("storyboard_id");

-- scenes
CREATE INDEX IF NOT EXISTS "scenes_project_id_idx" ON "scenes" ("project_id");

-- comments
CREATE INDEX IF NOT EXISTS "comments_project_id_idx" ON "comments" ("project_id");
CREATE INDEX IF NOT EXISTS "comments_scene_id_idx" ON "comments" ("scene_id");

-- assets
CREATE INDEX IF NOT EXISTS "assets_project_id_idx" ON "assets" ("project_id");
