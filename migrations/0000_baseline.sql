-- Baseline: full schema as of the introduction of migration 0010+.
-- Fully idempotent so it is a no-op on databases created earlier via `drizzle-kit push`.

CREATE TABLE IF NOT EXISTS "a11y_user_prefs" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"focus_mode" integer DEFAULT 0 NOT NULL,
	"dyslexia" integer DEFAULT 0 NOT NULL,
	"colorblind" integer DEFAULT 0 NOT NULL,
	"reduced_motion" integer DEFAULT 0 NOT NULL,
	"large_touch" integer DEFAULT 0 NOT NULL,
	"audio_cues" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_signoffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"milestone" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approver_name" text,
	"signature" text,
	"signature_hash" text,
	"notes" text,
	"approved_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audio2_cues" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"timestamp_ms" integer NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT '#9DD0FF' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audio2_lipsync" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"transcript" text NOT NULL,
	"timeline_json" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "biz_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "biz_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"project_id" integer,
	"date" text NOT NULL,
	"category" text NOT NULL,
	"amount" real NOT NULL,
	"notes" text,
	"receipt_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "biz_festivals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"deadline" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"fee" real DEFAULT 0,
	"notes" text,
	"project_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenge_leaderboard_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_number" integer NOT NULL,
	"user_id" integer NOT NULL,
	"submission_id" integer NOT NULL,
	"rank" integer NOT NULL,
	"total_reactions" integer DEFAULT 0 NOT NULL,
	"top_sticker" text,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenge_prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_number" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_speedrun" boolean DEFAULT false NOT NULL,
	"deadline_hours" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenge_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"sticker" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenge_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"prompt_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"image_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lor_asset_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"version_num" integer NOT NULL,
	"file_data" text NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lor_casting_matrix" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"scene_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"present" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lor_continuity_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"category" text DEFAULT 'character' NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"image_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lor_palettes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text DEFAULT 'Palette' NOT NULL,
	"colors" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"avatar_color" text DEFAULT '#6E4FE8' NOT NULL,
	"password_hash" text NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tool_calls" text,
	"tool_call_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_chat_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"script_id" integer,
	"title" text DEFAULT 'AI Assistant' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "animatic_clips" (
	"id" serial PRIMARY KEY NOT NULL,
	"track_id" integer NOT NULL,
	"start_ms" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 2000 NOT NULL,
	"source_kind" text DEFAULT 'panel_ref' NOT NULL,
	"source_id" integer,
	"audio_data_url" text,
	"label" text DEFAULT '' NOT NULL,
	"fade_in_ms" integer DEFAULT 0 NOT NULL,
	"fade_out_ms" integer DEFAULT 0 NOT NULL,
	"volume" integer DEFAULT 1000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "animatic_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text DEFAULT 'Untitled Animatic' NOT NULL,
	"fps" integer DEFAULT 24 NOT NULL,
	"total_duration_ms" integer DEFAULT 8000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "animatic_tracks" (
	"id" serial PRIMARY KEY NOT NULL,
	"animatic_project_id" integer NOT NULL,
	"kind" text DEFAULT 'panel' NOT NULL,
	"name" text DEFAULT 'Track' NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"muted" boolean DEFAULT false NOT NULL,
	"volume" integer DEFAULT 1000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "animatics" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text DEFAULT 'Animatic' NOT NULL,
	"video_data" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"category" text DEFAULT 'Other' NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text DEFAULT '' NOT NULL,
	"file_data" text,
	"r2_key" text,
	"thumbnail_data" text,
	"notes" text DEFAULT '' NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"uploader_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aud_captions" (
	"id" serial PRIMARY KEY NOT NULL,
	"animatic_project_id" integer NOT NULL,
	"text" text NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aud_voice_takes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"scene_id" integer,
	"audio_data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bak_gltf_exports" (
	"id" serial PRIMARY KEY NOT NULL,
	"scene_id" integer NOT NULL,
	"file_data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bak_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"label" text DEFAULT 'Snapshot' NOT NULL,
	"json_blob" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cli_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"phase" text NOT NULL,
	"signed_name" text NOT NULL,
	"signature_data" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cli_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"scene_id" integer,
	"fields" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"scene_id" integer,
	"author_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commission_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"commission_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commission_pricing_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"kind" text DEFAULT 'package' NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_user_id" integer NOT NULL,
	"client_name" text NOT NULL,
	"client_email" text NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"reference_image" text,
	"deadline" text,
	"budget_range" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"linked_project_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dlt_commission_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"commission_id" integer NOT NULL,
	"hours" integer DEFAULT 0 NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbox_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"body" text NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"project_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "panel_pins" (
	"id" serial PRIMARY KEY NOT NULL,
	"panel_id" integer NOT NULL,
	"x_percent" integer DEFAULT 0 NOT NULL,
	"y_percent" integer DEFAULT 0 NOT NULL,
	"body" text NOT NULL,
	"author_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_ai_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"encrypted_key" text NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_color" text DEFAULT '#6E4FE8' NOT NULL,
	"deadline" text,
	"status" text DEFAULT 'active' NOT NULL,
	"share_token" text NOT NULL,
	"share_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cli_brand_logo" text,
	"cli_brand_color" text DEFAULT '#9DD0FF' NOT NULL,
	"cli_brand_welcome" text,
	"dlt_discord_webhook_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "renders" (
	"id" serial PRIMARY KEY NOT NULL,
	"scene_id" integer NOT NULL,
	"label" text DEFAULT 'Render' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"software" text DEFAULT 'Other' NOT NULL,
	"duration_seconds" integer,
	"file_url" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scene_time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"scene_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"started_at" integer NOT NULL,
	"ended_at" integer,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scenes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"number" text DEFAULT '1' NOT NULL,
	"title" text DEFAULT 'Untitled Scene' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'script' NOT NULL,
	"deadline" text,
	"assignee_id" integer,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text DEFAULT 'Untitled Script' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"source_type" text DEFAULT 'editor' NOT NULL,
	"source_format" text DEFAULT '',
	"original_key" text DEFAULT '',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "storyboard_panels" (
	"id" serial PRIMARY KEY NOT NULL,
	"storyboard_id" integer NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"image_data" text,
	"r2_key" text,
	"scene_id" integer,
	"caption" text DEFAULT '' NOT NULL,
	"dialogue" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"change_request" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ROUGH' NOT NULL,
	"frame_count" integer DEFAULT 24 NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "storyboards" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text DEFAULT 'Storyboard' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tag_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag_id" integer NOT NULL,
	"entity_kind" text NOT NULL,
	"entity_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6E4FE8' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "studio_credit_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"section" text NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "studio_render_budget" (
	"project_id" integer PRIMARY KEY NOT NULL,
	"total_minutes" real DEFAULT 600 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "studio_render_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"label" text NOT NULL,
	"minutes" real NOT NULL,
	"cost" real DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "studio_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"label" text NOT NULL,
	"parent_id" integer,
	"notes" text,
	"restored_from_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_project_id_idx" ON "assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cli_feedback_project_id_idx" ON "cli_feedback" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cli_feedback_scene_id_idx" ON "cli_feedback" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_project_id_idx" ON "comments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_scene_id_idx" ON "comments" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_members_project_id_idx" ON "project_members" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_members_user_id_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_owner_id_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scenes_project_id_idx" ON "scenes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scripts_project_id_idx" ON "scripts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "storyboard_panels_storyboard_id_idx" ON "storyboard_panels" USING btree ("storyboard_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "storyboard_panels_scene_id_idx" ON "storyboard_panels" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "storyboards_project_id_idx" ON "storyboards" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_activity_log_user_date_idx" ON "user_activity_log" USING btree ("user_id","date");