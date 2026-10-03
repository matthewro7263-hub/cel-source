-- Migration 0018: indexes for the columns the API filters by.
-- None of these tables had an index on the project / scene / user they belong to, so every list query
-- scanned the whole table. Idempotent: safe to run repeatedly and on databases created via `drizzle-kit push`.

CREATE INDEX IF NOT EXISTS "achievements_user_id_idx" ON "achievements" ("user_id");
CREATE INDEX IF NOT EXISTS "ai_chat_messages_session_id_idx" ON "ai_chat_messages" ("session_id");
CREATE INDEX IF NOT EXISTS "ai_chat_sessions_project_id_idx" ON "ai_chat_sessions" ("project_id");
CREATE INDEX IF NOT EXISTS "animatic_clips_track_id_idx" ON "animatic_clips" ("track_id");
CREATE INDEX IF NOT EXISTS "animatic_projects_project_id_idx" ON "animatic_projects" ("project_id");
CREATE INDEX IF NOT EXISTS "animatic_tracks_animatic_project_id_idx" ON "animatic_tracks" ("animatic_project_id");
CREATE INDEX IF NOT EXISTS "animatics_project_id_idx" ON "animatics" ("project_id");
CREATE INDEX IF NOT EXISTS "approval_signoffs_project_id_idx" ON "approval_signoffs" ("project_id");
CREATE INDEX IF NOT EXISTS "aud_captions_animatic_project_id_idx" ON "aud_captions" ("animatic_project_id");
CREATE INDEX IF NOT EXISTS "aud_voice_takes_project_id_idx" ON "aud_voice_takes" ("project_id");
CREATE INDEX IF NOT EXISTS "aud_voice_takes_scene_id_idx" ON "aud_voice_takes" ("scene_id");
CREATE INDEX IF NOT EXISTS "audio2_cues_project_id_idx" ON "audio2_cues" ("project_id");
CREATE INDEX IF NOT EXISTS "audio2_lipsync_project_id_idx" ON "audio2_lipsync" ("project_id");
CREATE INDEX IF NOT EXISTS "bak_gltf_exports_scene_id_idx" ON "bak_gltf_exports" ("scene_id");
CREATE INDEX IF NOT EXISTS "bak_snapshots_project_id_idx" ON "bak_snapshots" ("project_id");
CREATE INDEX IF NOT EXISTS "biz_contracts_user_id_idx" ON "biz_contracts" ("user_id");
CREATE INDEX IF NOT EXISTS "biz_expenses_user_id_idx" ON "biz_expenses" ("user_id");
CREATE INDEX IF NOT EXISTS "biz_expenses_project_id_idx" ON "biz_expenses" ("project_id");
CREATE INDEX IF NOT EXISTS "biz_festivals_user_id_idx" ON "biz_festivals" ("user_id");
CREATE INDEX IF NOT EXISTS "biz_festivals_project_id_idx" ON "biz_festivals" ("project_id");
CREATE INDEX IF NOT EXISTS "cli_approvals_project_id_idx" ON "cli_approvals" ("project_id");
CREATE INDEX IF NOT EXISTS "commission_line_items_commission_id_idx" ON "commission_line_items" ("commission_id");
CREATE INDEX IF NOT EXISTS "commission_pricing_presets_project_id_idx" ON "commission_pricing_presets" ("project_id");
CREATE INDEX IF NOT EXISTS "commissions_linked_project_id_idx" ON "commissions" ("linked_project_id");
CREATE INDEX IF NOT EXISTS "dlt_commission_hours_commission_id_idx" ON "dlt_commission_hours" ("commission_id");
CREATE INDEX IF NOT EXISTS "inbox_items_user_id_idx" ON "inbox_items" ("user_id");
CREATE INDEX IF NOT EXISTS "inbox_items_project_id_idx" ON "inbox_items" ("project_id");
CREATE INDEX IF NOT EXISTS "lor_asset_versions_asset_id_idx" ON "lor_asset_versions" ("asset_id");
CREATE INDEX IF NOT EXISTS "lor_casting_matrix_project_id_idx" ON "lor_casting_matrix" ("project_id");
CREATE INDEX IF NOT EXISTS "lor_continuity_facts_project_id_idx" ON "lor_continuity_facts" ("project_id");
CREATE INDEX IF NOT EXISTS "lor_palettes_project_id_idx" ON "lor_palettes" ("project_id");
CREATE INDEX IF NOT EXISTS "panel_pins_panel_id_idx" ON "panel_pins" ("panel_id");
CREATE INDEX IF NOT EXISTS "project_ai_keys_project_id_idx" ON "project_ai_keys" ("project_id");
CREATE INDEX IF NOT EXISTS "renders_scene_id_idx" ON "renders" ("scene_id");
CREATE INDEX IF NOT EXISTS "scene_time_entries_user_id_idx" ON "scene_time_entries" ("user_id");
CREATE INDEX IF NOT EXISTS "studio_credit_entries_project_id_idx" ON "studio_credit_entries" ("project_id");
CREATE INDEX IF NOT EXISTS "studio_render_events_project_id_idx" ON "studio_render_events" ("project_id");
CREATE INDEX IF NOT EXISTS "studio_snapshots_project_id_idx" ON "studio_snapshots" ("project_id");
CREATE INDEX IF NOT EXISTS "tag_assignments_tag_id_idx" ON "tag_assignments" ("tag_id");
CREATE INDEX IF NOT EXISTS "tags_user_id_idx" ON "tags" ("user_id");
CREATE INDEX IF NOT EXISTS "tag_assignments_entity_idx" ON "tag_assignments" ("entity_kind", "entity_id");
CREATE INDEX IF NOT EXISTS "challenge_leaderboard_snapshots_week_rank_idx" ON "challenge_leaderboard_snapshots" ("week_number", "rank");
CREATE INDEX IF NOT EXISTS "lor_casting_matrix_scene_id_idx" ON "lor_casting_matrix" ("scene_id");
CREATE INDEX IF NOT EXISTS "challenge_leaderboard_snapshots_user_id_idx" ON "challenge_leaderboard_snapshots" ("user_id");
