import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== USERS =====
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarColor: text("avatar_color").notNull().default("#6E4FE8"),
  passwordHash: text("password_hash").notNull(),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ===== PROJECTS =====
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: integer("owner_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  coverColor: text("cover_color").notNull().default("#6E4FE8"),
  deadline: text("deadline"),
  status: text("status").notNull().default("active"),
  shareToken: text("share_token").notNull(),
  shareEnabled: integer("share_enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(""),
  // === AGENT_1 ADDITIONS START ===
  cli_brandLogo: text("cli_brand_logo"), // base64
  cli_brandColor: text("cli_brand_color").notNull().default("#9DD0FF"),
  cli_brandWelcome: text("cli_brand_welcome"),
  // === AGENT_1 ADDITIONS END ===
  // === AGENT_5 ADDITIONS START ===
  dltDiscordWebhookUrl: text("dlt_discord_webhook_url"),
  // === AGENT_5 ADDITIONS END ===
});
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// ===== PROJECT MEMBERS =====
export const projectMembers = sqliteTable("project_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("editor"),
});
export const insertProjectMemberSchema = createInsertSchema(projectMembers).omit({ id: true });
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type ProjectMember = typeof projectMembers.$inferSelect;

// ===== SCRIPTS =====
export const scripts = sqliteTable("scripts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull().default("Untitled Script"),
  content: text("content").notNull().default(""),
  sourceType: text("source_type").notNull().default("editor"),
  sourceFormat: text("source_format").default(""),
  originalKey: text("original_key").default(""),
  updatedAt: text("updated_at").notNull().default(""),
  deletedAt: text("deleted_at"),
});
export const insertScriptSchema = createInsertSchema(scripts).omit({ id: true, updatedAt: true });
export type InsertScript = z.infer<typeof insertScriptSchema>;
export type Script = typeof scripts.$inferSelect;

// ===== STORYBOARDS =====
export const storyboards = sqliteTable("storyboards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull().default("Storyboard"),
  createdAt: text("created_at").notNull().default(""),
});
export const insertStoryboardSchema = createInsertSchema(storyboards).omit({ id: true, createdAt: true });
export type InsertStoryboard = z.infer<typeof insertStoryboardSchema>;
export type Storyboard = typeof storyboards.$inferSelect;

// ===== STORYBOARD PANELS =====
export const storyboardPanels = sqliteTable("storyboard_panels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storyboardId: integer("storyboard_id").notNull(),
  orderIdx: integer("order_idx").notNull().default(0),
  imageData: text("image_data").notNull(),
  caption: text("caption").notNull().default(""),
  dialogue: text("dialogue").notNull().default(""),
  deletedAt: text("deleted_at"),
});
export const insertPanelSchema = createInsertSchema(storyboardPanels).omit({ id: true });
export type InsertPanel = z.infer<typeof insertPanelSchema>;
export type Panel = typeof storyboardPanels.$inferSelect;

// ===== ANIMATICS =====
export const animatics = sqliteTable("animatics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull().default("Animatic"),
  videoData: text("video_data").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(""),
});
export const insertAnimaticSchema = createInsertSchema(animatics).omit({ id: true, createdAt: true });
export type InsertAnimatic = z.infer<typeof insertAnimaticSchema>;
export type Animatic = typeof animatics.$inferSelect;

// ===== SCENES =====
export const scenes = sqliteTable("scenes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  number: text("number").notNull().default("1"),
  title: text("title").notNull().default("Untitled Scene"),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("script"),
  deadline: text("deadline"),
  assigneeId: integer("assignee_id"),
  deletedAt: text("deleted_at"),
});
export const insertSceneSchema = createInsertSchema(scenes).omit({ id: true });
export type InsertScene = z.infer<typeof insertSceneSchema>;
export type Scene = typeof scenes.$inferSelect;

// ===== COMMENTS =====
export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  sceneId: integer("scene_id"),
  authorId: integer("author_id").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(""),
});
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// ===== ASSETS =====
export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  category: text("category").notNull().default("Other"), // Characters | Backgrounds | Props | References | Other
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull().default(""),
  fileData: text("file_data").notNull(), // base64 data URL
  thumbnailData: text("thumbnail_data"), // null for non-images
  notes: text("notes").notNull().default(""),
  tags: text("tags").notNull().default(""), // comma-separated
  uploaderId: integer("uploader_id").notNull(),
  createdAt: text("created_at").notNull().default(""),
  deletedAt: text("deleted_at"),
});
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

// ===== COMMISSIONS =====
export const commissions = sqliteTable("commissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerUserId: integer("owner_user_id").notNull(), // artist
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  type: text("type").notNull(), // Character art | Animation - 2D | Animation - 3D | Storyboard | Other
  description: text("description").notNull(),
  referenceImage: text("reference_image"), // nullable base64
  deadline: text("deadline"), // date string
  budgetRange: text("budget_range").notNull(), // Under $50 | $50-$150 | $150-$500 | $500+ | Discuss
  status: text("status").notNull().default("new"), // new | quoted | accepted | in-progress | delivered | declined
  notes: text("notes").notNull().default(""), // artist's private notes
  linkedProjectId: integer("linked_project_id"), // set when converted to project
  createdAt: text("created_at").notNull().default(""),
});
export const insertCommissionSchema = createInsertSchema(commissions).omit({ id: true, createdAt: true, linkedProjectId: true });
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissions.$inferSelect;

// ===== ANIMATIC PROJECTS (v2 multi-track editor) =====
export const animaticProjects = sqliteTable("animatic_projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull().default("Untitled Animatic"),
  fps: integer("fps").notNull().default(24),
  totalDurationMs: integer("total_duration_ms").notNull().default(8000),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});
export const insertAnimaticProjectSchema = createInsertSchema(animaticProjects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAnimaticProject = z.infer<typeof insertAnimaticProjectSchema>;
export type AnimaticProject = typeof animaticProjects.$inferSelect;

// ===== ANIMATIC TRACKS =====
export const animaticTracks = sqliteTable("animatic_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  animaticProjectId: integer("animatic_project_id").notNull(),
  kind: text("kind").notNull().default("panel"), // panel | voice | sfx | music
  name: text("name").notNull().default("Track"),
  orderIdx: integer("order_idx").notNull().default(0),
  muted: integer("muted", { mode: "boolean" }).notNull().default(false),
  volume: text("volume").notNull().default("1.0"), // stored as text to avoid float precision issues
});
export const insertAnimaticTrackSchema = createInsertSchema(animaticTracks).omit({ id: true });
export type InsertAnimaticTrack = z.infer<typeof insertAnimaticTrackSchema>;
export type AnimaticTrack = typeof animaticTracks.$inferSelect;

// ===== ANIMATIC CLIPS =====
export const animaticClips = sqliteTable("animatic_clips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackId: integer("track_id").notNull(),
  startMs: integer("start_ms").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(2000),
  sourceKind: text("source_kind").notNull().default("panel_ref"), // panel_ref | asset_ref | audio_data
  sourceId: integer("source_id"), // storyboardPanelId or assetId, nullable
  audioDataUrl: text("audio_data_url"), // base64 for ad-hoc uploads, nullable
  label: text("label").notNull().default(""),
  fadeInMs: integer("fade_in_ms").notNull().default(0),
  fadeOutMs: integer("fade_out_ms").notNull().default(0),
  volume: text("volume").notNull().default("1.0"),
});
export const insertAnimaticClipSchema = createInsertSchema(animaticClips).omit({ id: true });
export type InsertAnimaticClip = z.infer<typeof insertAnimaticClipSchema>;
export type AnimaticClip = typeof animaticClips.$inferSelect;

// ===== RENDERS =====
export const renders = sqliteTable("renders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sceneId: integer("scene_id").notNull(),
  label: text("label").notNull().default("Render"), // e.g. "v3 final"
  status: text("status").notNull().default("queued"), // queued | running | done | failed
  software: text("software").notNull().default("Other"), // Blender | Moho | After Effects | Other
  durationSeconds: integer("duration_seconds"), // nullable
  fileUrl: text("file_url").notNull().default(""), // external link to MP4/folder
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(""),
});
export const insertRenderSchema = createInsertSchema(renders).omit({ id: true, createdAt: true });
export type InsertRender = z.infer<typeof insertRenderSchema>;
export type Render = typeof renders.$inferSelect;

// ============================================================
// v4 AI Shot Helper
// ============================================================
export const projectAiKeys = sqliteTable("project_ai_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  encryptedKey: text("encrypted_key").notNull(), // base64 obfuscation (NOT real encryption - see build notes)
  model: text("model"), // Optional model preference
  createdAt: text("created_at").notNull().default(""),
});
export const insertProjectAiKeySchema = createInsertSchema(projectAiKeys).omit({ id: true, createdAt: true });
export type InsertProjectAiKey = z.infer<typeof insertProjectAiKeySchema>;
export type ProjectAiKey = typeof projectAiKeys.$inferSelect;

// ============================================================
// v4 Achievements
// ============================================================
export const achievements = sqliteTable("achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  code: text("code").notNull(),
  unlockedAt: text("unlocked_at").notNull().default(""),
});
export const insertAchievementSchema = createInsertSchema(achievements).omit({ id: true });
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievements.$inferSelect;

// ============================================================
// v4 Panel Pins
// ============================================================
export const panelPins = sqliteTable("panel_pins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  panelId: integer("panel_id").notNull(),
  xPercent: integer("x_percent").notNull().default(0),
  yPercent: integer("y_percent").notNull().default(0),
  body: text("body").notNull(),
  authorId: integer("author_id").notNull(),
  createdAt: text("created_at").notNull().default(""),
});
export const insertPanelPinSchema = createInsertSchema(panelPins).omit({ id: true, createdAt: true });
export type InsertPanelPin = z.infer<typeof insertPanelPinSchema>;
export type PanelPin = typeof panelPins.$inferSelect;

// ============================================================
// v4 Commission Line Items + pricing cols (migration-style alter added in storage)
// ============================================================
export const commissionLineItems = sqliteTable("commission_line_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commissionId: integer("commission_id").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull().default(0),
  createdAt: text("created_at").notNull().default(""),
});
export const insertCommissionLineItemSchema = createInsertSchema(commissionLineItems).omit({ id: true, createdAt: true });
export type InsertCommissionLineItem = z.infer<typeof insertCommissionLineItemSchema>;
export type CommissionLineItem = typeof commissionLineItems.$inferSelect;

// ============================================================
// v4 Inbox Items
// ============================================================
export const inboxItems = sqliteTable("inbox_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  body: text("body").notNull(),
  tags: text("tags").notNull().default(""), // comma-separated
  projectId: integer("project_id"), // nullable
  createdAt: text("created_at").notNull().default(""),
});
export const insertInboxItemSchema = createInsertSchema(inboxItems).omit({ id: true, createdAt: true });
export type InsertInboxItem = z.infer<typeof insertInboxItemSchema>;
export type InboxItem = typeof inboxItems.$inferSelect;

// ============================================================
// v4 Tags + Tag Assignments
// ============================================================
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6E4FE8"),
});
export const insertTagSchema = createInsertSchema(tags).omit({ id: true });
export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;

export const tagAssignments = sqliteTable("tag_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tagId: integer("tag_id").notNull(),
  entityKind: text("entity_kind").notNull(), // scene | asset | panel | inboxItem
  entityId: integer("entity_id").notNull(),
});
export const insertTagAssignmentSchema = createInsertSchema(tagAssignments).omit({ id: true });
export type InsertTagAssignment = z.infer<typeof insertTagAssignmentSchema>;
export type TagAssignment = typeof tagAssignments.$inferSelect;

// ============================================================
// v4 Scene Time Entries
// ============================================================
export const sceneTimeEntries = sqliteTable("scene_time_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sceneId: integer("scene_id").notNull(),
  userId: integer("user_id").notNull(),
  startedAt: integer("started_at").notNull(), // timestamp ms
  endedAt: integer("ended_at"), // nullable
  durationMs: integer("duration_ms"), // computed when stopped
});
export const insertSceneTimeEntrySchema = createInsertSchema(sceneTimeEntries).omit({ id: true });
export type InsertSceneTimeEntry = z.infer<typeof insertSceneTimeEntrySchema>;
export type SceneTimeEntry = typeof sceneTimeEntries.$inferSelect;

// ============================================================
// v4 Commission Pricing Presets (per-project)
// ============================================================
// ============================================================
// v5 Agent 4 - Backup/Export/Game Dev
// ============================================================
export const bakSnapshots = sqliteTable("bak_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  label: text("label").notNull().default("Snapshot"),
  jsonBlob: text("json_blob").notNull(),
  createdAt: text("created_at").notNull().default(""),
});

export const bakGltfExports = sqliteTable("bak_gltf_exports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sceneId: integer("scene_id").notNull(),
  fileData: text("file_data").notNull(), // base64 or json string
  createdAt: text("created_at").notNull().default(""),
});

// ============================================================
// v5 Agent 5 - Analytics, Heatmap, Webhooks, Commission Hours
// ============================================================
export const dltCommissionHours = sqliteTable("dlt_commission_hours", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commissionId: integer("commission_id").notNull(),
  hours: integer("hours", { mode: "number" }).notNull().default(0), 
  loggedAt: text("logged_at").notNull().default(""),
});
export const insertDltCommissionHoursSchema = createInsertSchema(dltCommissionHours).omit({ id: true, loggedAt: true });
export type InsertDltCommissionHours = z.infer<typeof insertDltCommissionHoursSchema>;
export type DltCommissionHours = typeof dltCommissionHours.$inferSelect;

// ============================================================
// v5 Agent 2 - Audio Features
// ============================================================
export const audVoiceTakes = sqliteTable("aud_voice_takes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  sceneId: integer("scene_id"),
  audioData: text("audio_data").notNull(), // base64 WAV
  createdAt: text("created_at").notNull().default(""),
});
export const insertAudVoiceTakeSchema = createInsertSchema(audVoiceTakes).omit({ id: true, createdAt: true });

export type InsertAudVoiceTake = z.infer<typeof insertAudVoiceTakeSchema>;
export type AudVoiceTake = typeof audVoiceTakes.$inferSelect;

export const audCaptions = sqliteTable("aud_captions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  animaticProjectId: integer("animatic_project_id").notNull(),
  text: text("text").notNull(),
  startMs: integer("start_ms").notNull(),
  endMs: integer("end_ms").notNull(),
  createdAt: text("created_at").notNull().default(""),
});
export const insertAudCaptionSchema = createInsertSchema(audCaptions).omit({ id: true, createdAt: true });
export type InsertAudCaption = z.infer<typeof insertAudCaptionSchema>;
export type AudCaption = typeof audCaptions.$inferSelect;


// === AGENT_1 ADDITIONS START ===

// ===== CLI: APPROVALS =====
export const cli_approvals = sqliteTable("cli_approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  phase: text("phase").notNull(), // storyboard | animatic | final
  signedName: text("signed_name").notNull(),
  signatureData: text("signature_data").notNull(), // typed name rendered in cursive, stored as text or base64 (we'll just use the font to render it, so we can store the name or base64 of the image)
  signedAt: text("signed_at").notNull(),
});
export const insertCliApprovalSchema = createInsertSchema(cli_approvals).omit({ id: true });
export type InsertCliApproval = z.infer<typeof insertCliApprovalSchema>;
export type CliApproval = typeof cli_approvals.$inferSelect;

// ===== CLI: FEEDBACK =====
export const cli_feedback = sqliteTable("cli_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  sceneId: integer("scene_id"),
  fields: text("fields").notNull(), // JSON string representing the rubric
  createdAt: text("created_at").notNull().default(""),
});
export const insertCliFeedbackSchema = createInsertSchema(cli_feedback).omit({ id: true, createdAt: true });
export type InsertCliFeedback = z.infer<typeof insertCliFeedbackSchema>;
export type CliFeedback = typeof cli_feedback.$inferSelect;

// === AGENT_1 ADDITIONS END ===



// ============================================================
// v4 Commission Pricing Presets (per-project)
// ============================================================
export const commissionPricingPresets = sqliteTable("commission_pricing_presets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  kind: text("kind").notNull().default("package"), // package | addon
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull().default(0),
  createdAt: text("created_at").notNull().default(""),
});
export const insertCommissionPricingPresetSchema = createInsertSchema(commissionPricingPresets).omit({ id: true, createdAt: true });
export type InsertCommissionPricingPreset = z.infer<typeof insertCommissionPricingPresetSchema>;
export type CommissionPricingPreset = typeof commissionPricingPresets.$inferSelect;
