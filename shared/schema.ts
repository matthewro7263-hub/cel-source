import { pgTable, text, timestamp, integer , serial, boolean} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== USERS =====
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarColor: text("avatar_color").notNull().default("#6E4FE8"),
  passwordHash: text("password_hash").notNull(),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ===== PROJECTS =====
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  coverColor: text("cover_color").notNull().default("#6E4FE8"),
  deadline: text("deadline"),
  status: text("status").notNull().default("active"),
  shareToken: text("share_token").notNull(),
  shareEnabled: boolean("share_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  cli_brandLogo: text("cli_brand_logo"), // base64
  cli_brandColor: text("cli_brand_color").notNull().default("#9DD0FF"),
  cli_brandWelcome: text("cli_brand_welcome"),
  dltDiscordWebhookUrl: text("dlt_discord_webhook_url"),
  // CEL-MON-002: watermark upsell columns
  watermarkRemoved: boolean("watermark_removed").notNull().default(false),
  watermarkStripeSessionId: text("watermark_stripe_session_id"),
});
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// ===== PROJECT MEMBERS =====
export const projectMembers = pgTable("project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("editor"),
});
export const insertProjectMemberSchema = createInsertSchema(projectMembers).omit({ id: true });
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type ProjectMember = typeof projectMembers.$inferSelect;

// ===== SCRIPTS =====
export const scripts = pgTable("scripts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull().default("Untitled Script"),
  content: text("content").notNull().default(""),
  sourceType: text("source_type").notNull().default("editor"),
  sourceFormat: text("source_format").default(""),
  originalKey: text("original_key").default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).defaultNow(),
});
export const insertScriptSchema = createInsertSchema(scripts).omit({ id: true, updatedAt: true });
export type InsertScript = z.infer<typeof insertScriptSchema>;
export type Script = typeof scripts.$inferSelect;

// ===== STORYBOARDS =====
export const storyboards = pgTable("storyboards", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull().default("Storyboard"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertStoryboardSchema = createInsertSchema(storyboards).omit({ id: true, createdAt: true });
export type InsertStoryboard = z.infer<typeof insertStoryboardSchema>;
export type Storyboard = typeof storyboards.$inferSelect;

// ===== STORYBOARD PANELS =====
export const storyboardPanels = pgTable("storyboard_panels", {
  id: serial("id").primaryKey(),
  storyboardId: integer("storyboard_id").notNull(),
  orderIdx: integer("order_idx").notNull().default(0),
  imageData: text("image_data").notNull(),
  caption: text("caption").notNull().default(""),
  dialogue: text("dialogue").notNull().default(""),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).defaultNow(),
});
export const insertPanelSchema = createInsertSchema(storyboardPanels).omit({ id: true });
export type InsertPanel = z.infer<typeof insertPanelSchema>;
export type Panel = typeof storyboardPanels.$inferSelect;

// ===== ANIMATICS =====
export const animatics = pgTable("animatics", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull().default("Animatic"),
  videoData: text("video_data").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertAnimaticSchema = createInsertSchema(animatics).omit({ id: true, createdAt: true });
export type InsertAnimatic = z.infer<typeof insertAnimaticSchema>;
export type Animatic = typeof animatics.$inferSelect;

// ===== SCENES =====
export const scenes = pgTable("scenes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  number: text("number").notNull().default("1"),
  title: text("title").notNull().default("Untitled Scene"),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("script"),
  deadline: text("deadline"),
  assigneeId: integer("assignee_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).defaultNow(),
});
export const insertSceneSchema = createInsertSchema(scenes).omit({ id: true });
export type InsertScene = z.infer<typeof insertSceneSchema>;
export type Scene = typeof scenes.$inferSelect;

// ===== COMMENTS =====
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  sceneId: integer("scene_id"),
  authorId: integer("author_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// ===== ASSETS =====
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  category: text("category").notNull().default("Other"), // Characters | Backgrounds | Props | References | Other
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull().default(""),
  fileData: text("file_data").notNull(), // base64 data URL
  thumbnailData: text("thumbnail_data"), // null for non-images
  notes: text("notes").notNull().default(""),
  tags: text("tags").notNull().default(""), // comma-separated
  uploaderId: integer("uploader_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).defaultNow(),
});
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

// ===== COMMISSIONS =====
export const commissions = pgTable("commissions", {
  id: serial("id").primaryKey(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertCommissionSchema = createInsertSchema(commissions).omit({ id: true, createdAt: true, linkedProjectId: true });
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissions.$inferSelect;

// ===== ANIMATIC PROJECTS (v2 multi-track editor) =====
export const animaticProjects = pgTable("animatic_projects", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull().default("Untitled Animatic"),
  fps: integer("fps").notNull().default(24),
  totalDurationMs: integer("total_duration_ms").notNull().default(8000),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertAnimaticProjectSchema = createInsertSchema(animaticProjects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAnimaticProject = z.infer<typeof insertAnimaticProjectSchema>;
export type AnimaticProject = typeof animaticProjects.$inferSelect;

// ===== ANIMATIC TRACKS =====
export const animaticTracks = pgTable("animatic_tracks", {
  id: serial("id").primaryKey(),
  animaticProjectId: integer("animatic_project_id").notNull(),
  kind: text("kind").notNull().default("panel"), // panel | voice | sfx | music
  name: text("name").notNull().default("Track"),
  orderIdx: integer("order_idx").notNull().default(0),
  muted: boolean("muted").notNull().default(false),
  volume: text("volume").notNull().default("1.0"), // stored as text to avoid float precision issues
});
export const insertAnimaticTrackSchema = createInsertSchema(animaticTracks).omit({ id: true });
export type InsertAnimaticTrack = z.infer<typeof insertAnimaticTrackSchema>;
export type AnimaticTrack = typeof animaticTracks.$inferSelect;

// ===== ANIMATIC CLIPS =====
export const animaticClips = pgTable("animatic_clips", {
  id: serial("id").primaryKey(),
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
export const renders = pgTable("renders", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull(),
  label: text("label").notNull().default("Render"), // e.g. "v3 final"
  status: text("status").notNull().default("queued"), // queued | running | done | failed
  software: text("software").notNull().default("Other"), // Blender | Moho | After Effects | Other
  durationSeconds: integer("duration_seconds"), // nullable
  fileUrl: text("file_url").notNull().default(""), // external link to MP4/folder
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertRenderSchema = createInsertSchema(renders).omit({ id: true, createdAt: true });
export type InsertRender = z.infer<typeof insertRenderSchema>;
export type Render = typeof renders.$inferSelect;

// ============================================================
// v4 AI Shot Helper
// ============================================================
export const projectAiKeys = pgTable("project_ai_keys", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  encryptedKey: text("encrypted_key").notNull(), // base64 obfuscation (NOT real encryption - see build notes)
  model: text("model"), // Optional model preference
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertProjectAiKeySchema = createInsertSchema(projectAiKeys).omit({ id: true, createdAt: true });
export type InsertProjectAiKey = z.infer<typeof insertProjectAiKeySchema>;
export type ProjectAiKey = typeof projectAiKeys.$inferSelect;

export const aiChatSessions = pgTable("ai_chat_sessions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  scriptId: integer("script_id"), // Optional: lock session to a specific script
  title: text("title").notNull().default("AI Assistant"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertAiChatSessionSchema = createInsertSchema(aiChatSessions).omit({ id: true, createdAt: true });
export type InsertAiChatSession = z.infer<typeof insertAiChatSessionSchema>;
export type AiChatSession = typeof aiChatSessions.$inferSelect;

export const aiChatMessages = pgTable("ai_chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system' | 'tool'
  content: text("content").notNull(),
  toolCalls: text("tool_calls"), // JSON stringified tool_calls array
  toolCallId: text("tool_call_id"), // For 'tool' role responses
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertAiChatMessageSchema = createInsertSchema(aiChatMessages).omit({ id: true, createdAt: true });
export type InsertAiChatMessage = z.infer<typeof insertAiChatMessageSchema>;
export type AiChatMessage = typeof aiChatMessages.$inferSelect;


// ============================================================
// v4 Achievements
// ============================================================
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  code: text("code").notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertAchievementSchema = createInsertSchema(achievements).omit({ id: true });
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievements.$inferSelect;

// ============================================================
// v4 Panel Pins
// ============================================================
export const panelPins = pgTable("panel_pins", {
  id: serial("id").primaryKey(),
  panelId: integer("panel_id").notNull(),
  xPercent: integer("x_percent").notNull().default(0),
  yPercent: integer("y_percent").notNull().default(0),
  body: text("body").notNull(),
  authorId: integer("author_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertPanelPinSchema = createInsertSchema(panelPins).omit({ id: true, createdAt: true });
export type InsertPanelPin = z.infer<typeof insertPanelPinSchema>;
export type PanelPin = typeof panelPins.$inferSelect;

// ============================================================
// v4 Commission Line Items + pricing cols (migration-style alter added in storage)
// ============================================================
export const commissionLineItems = pgTable("commission_line_items", {
  id: serial("id").primaryKey(),
  commissionId: integer("commission_id").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertCommissionLineItemSchema = createInsertSchema(commissionLineItems).omit({ id: true, createdAt: true });
export type InsertCommissionLineItem = z.infer<typeof insertCommissionLineItemSchema>;
export type CommissionLineItem = typeof commissionLineItems.$inferSelect;

// ============================================================
// v4 Inbox Items
// ============================================================
export const inboxItems = pgTable("inbox_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  body: text("body").notNull(),
  tags: text("tags").notNull().default(""), // comma-separated
  projectId: integer("project_id"), // nullable
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertInboxItemSchema = createInsertSchema(inboxItems).omit({ id: true, createdAt: true });
export type InsertInboxItem = z.infer<typeof insertInboxItemSchema>;
export type InboxItem = typeof inboxItems.$inferSelect;

// ============================================================
// v4 Tags + Tag Assignments
// ============================================================
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6E4FE8"),
});
export const insertTagSchema = createInsertSchema(tags).omit({ id: true });
export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;

export const tagAssignments = pgTable("tag_assignments", {
  id: serial("id").primaryKey(),
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
export const sceneTimeEntries = pgTable("scene_time_entries", {
  id: serial("id").primaryKey(),
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
export const bakSnapshots = pgTable("bak_snapshots", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  label: text("label").notNull().default("Snapshot"),
  jsonBlob: text("json_blob").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const bakGltfExports = pgTable("bak_gltf_exports", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull(),
  fileData: text("file_data").notNull(), // base64 or json string
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// v5 Agent 5 - Analytics, Heatmap, Webhooks, Commission Hours
// ============================================================
export const dltCommissionHours = pgTable("dlt_commission_hours", {
  id: serial("id").primaryKey(),
  commissionId: integer("commission_id").notNull(),
  hours: integer("hours").notNull().default(0), 
  loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertDltCommissionHoursSchema = createInsertSchema(dltCommissionHours).omit({ id: true, loggedAt: true });
export type InsertDltCommissionHours = z.infer<typeof insertDltCommissionHoursSchema>;
export type DltCommissionHours = typeof dltCommissionHours.$inferSelect;

// ============================================================
// v5 Agent 2 - Audio Features
// ============================================================
export const audVoiceTakes = pgTable("aud_voice_takes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  sceneId: integer("scene_id"),
  audioData: text("audio_data").notNull(), // base64 WAV
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertAudVoiceTakeSchema = createInsertSchema(audVoiceTakes).omit({ id: true, createdAt: true });

export type InsertAudVoiceTake = z.infer<typeof insertAudVoiceTakeSchema>;
export type AudVoiceTake = typeof audVoiceTakes.$inferSelect;

export const audCaptions = pgTable("aud_captions", {
  id: serial("id").primaryKey(),
  animaticProjectId: integer("animatic_project_id").notNull(),
  text: text("text").notNull(),
  startMs: integer("start_ms").notNull(),
  endMs: integer("end_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertAudCaptionSchema = createInsertSchema(audCaptions).omit({ id: true, createdAt: true });
export type InsertAudCaption = z.infer<typeof insertAudCaptionSchema>;
export type AudCaption = typeof audCaptions.$inferSelect;



// ===== CLI: APPROVALS =====
export const cli_approvals = pgTable("cli_approvals", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  phase: text("phase").notNull(), // storyboard | animatic | final
  signedName: text("signed_name").notNull(),
  signatureData: text("signature_data").notNull(), // typed name rendered in cursive, stored as text or base64 (we'll just use the font to render it, so we can store the name or base64 of the image)
  signedAt: timestamp("signed_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertCliApprovalSchema = createInsertSchema(cli_approvals).omit({ id: true });
export type InsertCliApproval = z.infer<typeof insertCliApprovalSchema>;
export type CliApproval = typeof cli_approvals.$inferSelect;

// ===== CLI: FEEDBACK =====
export const cli_feedback = pgTable("cli_feedback", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  sceneId: integer("scene_id"),
  fields: text("fields").notNull(), // JSON string representing the rubric
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertCliFeedbackSchema = createInsertSchema(cli_feedback).omit({ id: true, createdAt: true });
export type InsertCliFeedback = z.infer<typeof insertCliFeedbackSchema>;
export type CliFeedback = typeof cli_feedback.$inferSelect;




// ============================================================
// v4 Commission Pricing Presets (per-project)
// ============================================================
export const commissionPricingPresets = pgTable("commission_pricing_presets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  kind: text("kind").notNull().default("package"), // package | addon
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertCommissionPricingPresetSchema = createInsertSchema(commissionPricingPresets).omit({ id: true, createdAt: true });
export type InsertCommissionPricingPreset = z.infer<typeof insertCommissionPricingPresetSchema>;
export type CommissionPricingPreset = typeof commissionPricingPresets.$inferSelect;
