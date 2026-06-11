-- Migration 0015: Performance indexes for hot query paths

-- projects.share_token (public share lookups)
CREATE INDEX IF NOT EXISTS "projects_share_token_idx" ON "projects" ("share_token");

-- commissions.owner_user_id (artist queue)
CREATE INDEX IF NOT EXISTS "commissions_owner_user_id_idx" ON "commissions" ("owner_user_id");

-- comments.author_id (activity feed author batching)
CREATE INDEX IF NOT EXISTS "comments_author_id_idx" ON "comments" ("author_id");

-- scene_time_entries.scene_id (timer aggregation)
CREATE INDEX IF NOT EXISTS "scene_time_entries_scene_id_idx" ON "scene_time_entries" ("scene_id");

-- challenge tables
CREATE INDEX IF NOT EXISTS "challenge_submissions_prompt_id_idx" ON "challenge_submissions" ("prompt_id");
CREATE INDEX IF NOT EXISTS "challenge_submissions_user_id_idx" ON "challenge_submissions" ("user_id");
CREATE INDEX IF NOT EXISTS "challenge_reactions_submission_id_idx" ON "challenge_reactions" ("submission_id");
CREATE INDEX IF NOT EXISTS "challenge_reactions_user_id_idx" ON "challenge_reactions" ("user_id");
CREATE INDEX IF NOT EXISTS "challenge_prompts_week_number_idx" ON "challenge_prompts" ("week_number");