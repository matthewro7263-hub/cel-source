import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { eq, and, or, inArray, asc, desc, like } from "drizzle-orm";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import * as mainSchema from "@shared/schema";
import * as a11ySchema from "@shared/a11y_schema";
import * as challengeSchema from "@shared/challenge_schema";
import * as lorSchema from "@shared/lor_schema";
import * as studioSchema from "@shared/studio_schema";

const schema = {
  ...mainSchema,
  ...a11ySchema,
  ...challengeSchema,
  ...lorSchema,
  ...studioSchema,
};

// Re-export individual tables for convenience in methods
const {
  users, projects, projectMembers, scripts, storyboards, storyboardPanels,
  animatics, scenes, comments, assets, commissions, renders,
  animaticProjects, animaticTracks, animaticClips,
  projectAiKeys, aiChatSessions, aiChatMessages, achievements, panelPins,
  commissionLineItems, inboxItems, tags, tagAssignments,
  sceneTimeEntries, commissionPricingPresets,
  audVoiceTakes, audCaptions,
  dltCommissionHours,
  cli_approvals, cli_feedback,
} = mainSchema;

const { a11y_user_prefs } = a11ySchema;
const { challenge_prompts, challenge_reactions, challenge_submissions } = challengeSchema;
const { lor_continuity_facts, lor_palettes, lor_asset_versions, lor_casting_matrix } = lorSchema;
const { studio_render_events, studio_render_budget, studio_snapshots, studio_credit_entries } = studioSchema;

// Types
export type {
  User, InsertUser, Project, InsertProject, ProjectMember, InsertProjectMember,
  Script, InsertScript, Storyboard, InsertStoryboard, Panel, InsertPanel,
  Animatic, InsertAnimatic, Scene, InsertScene, Comment, InsertComment,
  Asset, InsertAsset, Commission, InsertCommission, Render, InsertRender,
  AnimaticProject, InsertAnimaticProject, AnimaticTrack, InsertAnimaticTrack,
  AnimaticClip, InsertAnimaticClip,
  ProjectAiKey, InsertProjectAiKey,
  AiChatSession, InsertAiChatSession,
  AiChatMessage, InsertAiChatMessage,
  Achievement, InsertAchievement,
  PanelPin, InsertPanelPin,
  CommissionLineItem, InsertCommissionLineItem,
  InboxItem, InsertInboxItem,
  Tag, InsertTag,
  TagAssignment, InsertTagAssignment,
  SceneTimeEntry, InsertSceneTimeEntry,
  CommissionPricingPreset, InsertCommissionPricingPreset,
  DltCommissionHours, InsertDltCommissionHours,
  InsertAudVoiceTake, InsertAudCaption,
} from "@shared/schema";
export type { A11yPrefs, InsertA11yPrefs } from "@shared/a11y_schema";
export type { ChallengePrompt, ChallengeReaction, ChallengeSubmission, InsertChallengeSubmission } from "@shared/challenge_schema";
export type {
  LorContinuityFact, InsertLorContinuityFact,
  LorPalette, InsertLorPalette,
  LorAssetVersion, InsertLorAssetVersion,
  LorCastingMatrix, InsertLorCastingMatrix,
} from "@shared/lor_schema";
export type {
  StudioRenderEvent, InsertStudioRenderEvent,
  StudioRenderBudget,
  StudioSnapshot, InsertStudioSnapshot,
  StudioCreditEntry, InsertStudioCreditEntry,
} from "@shared/studio_schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });

// ===== PASSWORD UTILS =====
const SCRYPT_PARAMS = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, SCRYPT_PARAMS).toString("hex");
  return `v2:${salt}:${hash}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length === 2) {
    // Legacy format: salt:hash (uses default scrypt params)
    const [salt, hash] = parts;
    const check = scryptSync(password, salt, 64).toString("hex");
    try {
      return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
    } catch {
      return false;
    }
  } else if (parts.length === 3 && parts[0] === "v2") {
    // New format: v2:salt:hash
    const [, salt, hash] = parts;
    const check = scryptSync(password, salt, 64, SCRYPT_PARAMS).toString("hex");
    try {
      return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
    } catch {
      return false;
    }
  }
  return false;
}
export function genToken(len = 16): string {
  return randomBytes(len).toString("hex").slice(0, len);
}

// ===== SESSIONS (in-memory) =====
const sessions = new Map<string, number>(); // sessionId -> userId
export function createSession(userId: number): string {
  const sid = randomBytes(24).toString("hex");
  sessions.set(sid, userId);
  return sid;
}
export function getSessionUser(sid: string | undefined): number | undefined {
  if (!sid) return undefined;
  return sessions.get(sid);
}
export function destroySession(sid: string) {
  sessions.delete(sid);
}

export const storage = {
  // ===== USERS =====
  async getUser: (id: number) => await db.select().from(users).where(eq(users.id, id)).then(r => r[0]),
  async getUserByEmail: (email: string) => await db.select().from(users).where(eq(users.email, email)).then(r => r[0]),
  async createUser: (u: InsertUser) => await db.insert(users).values(u).returning().then(r => r[0]),
  async updateUser: (id: number, patch: Partial<InsertUser>) =>
    await db.update(users).set(patch).where(eq(users.id, id)).returning().then(r => r[0]),

  // ===== PROJECTS =====
  async listProjectsForUser: (userId: number): Project[] => {
    const memberRows = db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId))
      ;
    const ids = memberRows.map((r) => r.projectId);
    if (ids.length === 0) {
      return await db.select().from(projects).where(eq(projects.ownerId, userId));
    }
    return db
      .select()
      .from(projects)
      .where(or(eq(projects.ownerId, userId), inArray(projects.id, ids)))
      ;
  },
  async getProject: (id: number) => await db.select().from(projects).where(eq(projects.id, id)).then(r => r[0]),
  async getProjectByToken: (token: string) =>
    await db.select().from(projects).where(eq(projects.shareToken, token)).then(r => r[0]),
  async createProject: (p: InsertProject): Project => {
    const row = await db.insert(projects).values({ ...p, createdAt: new Date() }).returning().then(r => r[0]);
    return row;
  },
  async updateProject: (id: number, patch: Partial<InsertProject>) =>
    await db.update(projects).set(patch).where(eq(projects.id, id)).returning().then(r => r[0]),
  async deleteProject: (id: number) => {
    await db.delete(comments).where(eq(comments.projectId, id));
    await db.delete(scenes).where(eq(scenes.projectId, id));
    const sbs = await db.select().from(storyboards).where(eq(storyboards.projectId, id));
    for (const sb of sbs) await db.delete(storyboardPanels).where(eq(storyboardPanels.storyboardId, sb.id));
    await db.delete(storyboards).where(eq(storyboards.projectId, id));
    await db.delete(animatics).where(eq(animatics.projectId, id));
    await db.delete(scripts).where(eq(scripts.projectId, id));
    await db.delete(projectMembers).where(eq(projectMembers.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
  },

  // ===== MEMBERS =====
  async listMembers: (projectId: number): (ProjectMember & { user: User })[] => {
    const rows = await db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));
    if (rows.length === 0) return [];
    const userIds = rows.map(r => r.userId);
    const allUsers = await db.select().from(users).where(inArray(users.id, userIds));
    const userMap = allUsers.reduce((acc, u) => {
      acc[u.id] = u;
      return acc;
    }, {} as Record<number, User>);
    return rows.map((r) => ({ ...r, user: userMap[r.userId]! }));
  },
  async addMember: (m: InsertProjectMember) => await db.insert(projectMembers).values(m).returning().then(r => r[0]),
  async removeMember: (projectId: number, userId: number) =>
    await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))),
  async isMember: (projectId: number, userId: number): boolean => {
    const row = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).then(r => r[0]);
    return !!row;
  },

  // ===== SCRIPTS =====
  async listScripts: (projectId: number) => await db.select().from(scripts).where(eq(scripts.projectId, projectId)),
  async getScript: (id: number) => await db.select().from(scripts).where(eq(scripts.id, id)).then(r => r[0]),
  async createScript: (s: InsertScript) => await db.insert(scripts).values({ ...s, updatedAt: new Date() }).returning().then(r => r[0]),
  async updateScript: (id: number, patch: Partial<InsertScript>) =>
    await db.update(scripts).set({ ...patch, updatedAt: new Date() }).where(eq(scripts.id, id)).returning().then(r => r[0]),
  async deleteScript: (id: number) => await db.delete(scripts).where(eq(scripts.id, id)),

  // ===== STORYBOARDS =====
  async listStoryboards: (projectId: number) => await db.select().from(storyboards).where(eq(storyboards.projectId, projectId)),
  async getStoryboard: (id: number) => await db.select().from(storyboards).where(eq(storyboards.id, id)).then(r => r[0]),
  async createStoryboard: (s: InsertStoryboard) =>
    await db.insert(storyboards).values({ ...s, createdAt: new Date() }).returning().then(r => r[0]),
  async deleteStoryboard: (id: number) => {
    await db.delete(storyboardPanels).where(eq(storyboardPanels.storyboardId, id));
    await db.delete(storyboards).where(eq(storyboards.id, id));
  },

  // ===== PANELS =====
  async listPanels: (storyboardId: number) =>
    await db.select().from(storyboardPanels).where(eq(storyboardPanels.storyboardId, storyboardId)).orderBy(asc(storyboardPanels.orderIdx)),
  async createPanel: (p: InsertPanel) => await db.insert(storyboardPanels).values(p).returning().then(r => r[0]),
  async updatePanel: (id: number, patch: Partial<InsertPanel>) =>
    await db.update(storyboardPanels).set(patch).where(eq(storyboardPanels.id, id)).returning().then(r => r[0]),
  async deletePanel: (id: number) => await db.delete(storyboardPanels).where(eq(storyboardPanels.id, id)),
  async getPanel: (id: number) => await db.select().from(storyboardPanels).where(eq(storyboardPanels.id, id)).then(r => r[0]),

  // ===== ANIMATICS =====
  async listAnimatics: (projectId: number) => await db.select().from(animatics).where(eq(animatics.projectId, projectId)),
  async createAnimatic: (a: InsertAnimatic) =>
    await db.insert(animatics).values({ ...a, createdAt: new Date() }).returning().then(r => r[0]),
  async deleteAnimatic: (id: number) => await db.delete(animatics).where(eq(animatics.id, id)),

  // ===== SCENES =====
  async listScenes: (projectId: number) => await db.select().from(scenes).where(eq(scenes.projectId, projectId)),
  async getScene: (id: number) => await db.select().from(scenes).where(eq(scenes.id, id)).then(r => r[0]),
  async createScene: (s: InsertScene) => await db.insert(scenes).values(s).returning().then(r => r[0]),
  async updateScene: (id: number, patch: Partial<InsertScene>) =>
    await db.update(scenes).set(patch).where(eq(scenes.id, id)).returning().then(r => r[0]),
  async deleteScene: (id: number) => await db.delete(scenes).where(eq(scenes.id, id)),

  // ===== COMMENTS =====
  async listComments: (projectId: number) =>
    await db.select().from(comments).where(eq(comments.projectId, projectId)).orderBy(desc(comments.createdAt)),
  async createComment: (c: InsertComment) =>
    await db.insert(comments).values({ ...c, createdAt: new Date() }).returning().then(r => r[0]),
  async deleteComment: (id: number) => await db.delete(comments).where(eq(comments.id, id)),

  // ===== ASSETS =====
  async listAssets: (projectId: number, category?: string): Asset[] => {
    if (category) {
      return await db.select().from(assets).where(and(eq(assets.projectId, projectId), eq(assets.category, category))).orderBy(desc(assets.createdAt));
    }
    return await db.select().from(assets).where(eq(assets.projectId, projectId)).orderBy(desc(assets.createdAt));
  },
  async getAsset: (id: number) => await db.select().from(assets).where(eq(assets.id, id)).then(r => r[0]),
  async createAsset: (a: InsertAsset): Asset =>
    await db.insert(assets).values({ ...a, createdAt: new Date() }).returning().then(r => r[0]),
  async updateAsset: (id: number, patch: Partial<Pick<InsertAsset, 'notes' | 'tags' | 'category'>>) =>
    await db.update(assets).set(patch).where(eq(assets.id, id)).returning().then(r => r[0]),
  async deleteAsset: (id: number) => await db.delete(assets).where(eq(assets.id, id)),

  // ===== COMMISSIONS =====
  async listCommissions: (ownerUserId: number): Commission[] =>
    await db.select().from(commissions).where(eq(commissions.ownerUserId, ownerUserId)).orderBy(asc(commissions.status), desc(commissions.createdAt)),
  async getCommission: (id: number) => await db.select().from(commissions).where(eq(commissions.id, id)).then(r => r[0]),
  async createCommission: (c: InsertCommission): Commission =>
    await db.insert(commissions).values({ ...c, createdAt: new Date() }).returning().then(r => r[0]),
  async updateCommission: (id: number, patch: Partial<Pick<Commission, 'status' | 'notes' | 'linkedProjectId'>>) =>
    await db.update(commissions).set(patch).where(eq(commissions.id, id)).returning().then(r => r[0]),

  // ===== RENDERS =====
  async listRenders: (sceneId: number): Render[] =>
    await db.select().from(renders).where(eq(renders.sceneId, sceneId)).orderBy(desc(renders.createdAt)),
  async getRender: (id: number) => await db.select().from(renders).where(eq(renders.id, id)).then(r => r[0]),
  async createRender: (r: InsertRender): Render =>
    await db.insert(renders).values({ ...r, createdAt: new Date() }).returning().then(r => r[0]),
  async updateRender: (id: number, patch: Partial<InsertRender>) =>
    await db.update(renders).set(patch).where(eq(renders.id, id)).returning().then(r => r[0]),
  async deleteRender: (id: number) => await db.delete(renders).where(eq(renders.id, id)),

  // ===== ANIMATIC PROJECTS (v2) =====
  async getAnimaticProjectsByProject: (projectId: number): AnimaticProject[] =>
    await db.select().from(animaticProjects).where(eq(animaticProjects.projectId, projectId)).orderBy(desc(animaticProjects.createdAt)),

  async getAnimaticProject: (id: number) => {
    const ap = await db.select().from(animaticProjects).where(eq(animaticProjects.id, id)).then(r => r[0]);
    if (!ap) return undefined;
    const tracks = await db.select().from(animaticTracks).where(eq(animaticTracks.animaticProjectId, id)).orderBy(asc(animaticTracks.orderIdx));
    const allClips = tracks.length > 0
      ? await db.select().from(animaticClips).where(inArray(animaticClips.trackId, tracks.map(t => t.id)))
      : [];
    const tracksWithClips = tracks.map(t => ({
      ...t,
      clips: allClips.filter(c => c.trackId === t.id).sort((a, b) => a.startMs - b.startMs),
    }));
    return { ...ap, tracks: tracksWithClips };
  },

  async createAnimaticProject: (data: InsertAnimaticProject): AnimaticProject => {
    const now = new Date();
    const ap = await db.insert(animaticProjects).values({ ...data, createdAt: now, updatedAt: now }).returning().then(r => r[0]);
    // Create 4 default tracks
    const defaultTracks: { kind: string; name: string; orderIdx: number }[] = [
      { kind: "panel", name: "Panels", orderIdx: 0 },
      { kind: "voice", name: "Voice", orderIdx: 1 },
      { kind: "sfx", name: "SFX", orderIdx: 2 },
      { kind: "music", name: "Music", orderIdx: 3 },
    ];
    for (const t of defaultTracks) {
      await db.insert(animaticTracks).values({ animaticProjectId: ap.id, kind: t.kind, name: t.name, orderIdx: t.orderIdx, muted: false, volume: "1.0" });
    }
    return ap;
  },

  async updateAnimaticProject: (id: number, patch: Partial<InsertAnimaticProject>) =>
    await db.update(animaticProjects).set({ ...patch, updatedAt: new Date() }).where(eq(animaticProjects.id, id)).returning().then(r => r[0]),

  async deleteAnimaticProject: (id: number) => {
    const tracks = await db.select().from(animaticTracks).where(eq(animaticTracks.animaticProjectId, id));
    for (const t of tracks) {
      await db.delete(animaticClips).where(eq(animaticClips.trackId, t.id));
    }
    await db.delete(animaticTracks).where(eq(animaticTracks.animaticProjectId, id));
    await db.delete(animaticProjects).where(eq(animaticProjects.id, id));
  },

  // ===== ANIMATIC TRACKS =====
  async createTrack: (data: InsertAnimaticTrack): AnimaticTrack =>
    await db.insert(animaticTracks).values(data).returning().then(r => r[0]),

  async updateTrack: (id: number, patch: Partial<InsertAnimaticTrack>) =>
    await db.update(animaticTracks).set(patch).where(eq(animaticTracks.id, id)).returning().then(r => r[0]),

  async deleteTrack: (id: number) => {
    await db.delete(animaticClips).where(eq(animaticClips.trackId, id));
    await db.delete(animaticTracks).where(eq(animaticTracks.id, id));
  },

  async getTrack: (id: number) => await db.select().from(animaticTracks).where(eq(animaticTracks.id, id)).then(r => r[0]),

  // ===== ANIMATIC CLIPS =====
  async createClip: (data: InsertAnimaticClip): AnimaticClip =>
    await db.insert(animaticClips).values(data).returning().then(r => r[0]),

  async updateClip: (id: number, patch: Partial<InsertAnimaticClip>) =>
    await db.update(animaticClips).set(patch).where(eq(animaticClips.id, id)).returning().then(r => r[0]),

  async deleteClip: (id: number) => await db.delete(animaticClips).where(eq(animaticClips.id, id)),

  async getClip: (id: number) => await db.select().from(animaticClips).where(eq(animaticClips.id, id)).then(r => r[0]),

  // raw access for seed
  _db: db,
};

// ============================================================
// v4 — table creation and extensions
// ============================================================
// Create v4 tables (idempotent)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS project_ai_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  encrypted_key TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  script_id INTEGER,
  title TEXT NOT NULL DEFAULT 'AI Assistant',
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,
  tool_call_id TEXT,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  unlocked_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS panel_pins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  panel_id INTEGER NOT NULL,
  x_percent INTEGER NOT NULL DEFAULT 0,
  y_percent INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  author_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS commission_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commission_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS inbox_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  project_id INTEGER,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6E4FE8'
);
CREATE TABLE IF NOT EXISTS tag_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id INTEGER NOT NULL,
  entity_kind TEXT NOT NULL,
  entity_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS scene_time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_ms INTEGER
);
CREATE TABLE IF NOT EXISTS commission_pricing_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'package',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ''
);
`);

// Migrate existing commissions table to add v4 columns (safe, idempotent)
try { sqlite.exec(`ALTER TABLE commissions ADD COLUMN quote_cents INTEGER`); } catch {}
try { sqlite.exec(`ALTER TABLE commissions ADD COLUMN paid_cents INTEGER`); } catch {}
try { sqlite.exec(`ALTER TABLE commissions ADD COLUMN invoiced_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE approval_signoffs ADD COLUMN signature_hash TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE project_ai_keys ADD COLUMN model TEXT`); } catch {}

// ===== v5 bak modifications =====
try { sqlite.exec(`ALTER TABLE scripts ADD COLUMN deleted_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE scripts ADD COLUMN source_type TEXT NOT NULL DEFAULT 'editor'`); } catch {}
try { sqlite.exec(`ALTER TABLE scripts ADD COLUMN source_format TEXT DEFAULT ''`); } catch {}
try { sqlite.exec(`ALTER TABLE scripts ADD COLUMN original_key TEXT DEFAULT ''`); } catch {}
try { sqlite.exec(`ALTER TABLE storyboard_panels ADD COLUMN deleted_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE scenes ADD COLUMN deleted_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE assets ADD COLUMN deleted_at TEXT`); } catch {}

// v5 Agent 5
try { sqlite.exec(`ALTER TABLE projects ADD COLUMN dlt_discord_webhook_url TEXT`); } catch {}

try { sqlite.exec(`ALTER TABLE projects ADD COLUMN cli_brand_logo TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE projects ADD COLUMN cli_brand_color TEXT NOT NULL DEFAULT '#9DD0FF'`); } catch {}
try { sqlite.exec(`ALTER TABLE projects ADD COLUMN cli_brand_welcome TEXT`); } catch {}

sqlite.exec(`
CREATE TABLE IF NOT EXISTS cli_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  phase TEXT NOT NULL,
  signed_name TEXT NOT NULL,
  signature_data TEXT NOT NULL,
  signed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cli_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  scene_id INTEGER,
  fields TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ''
);
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS bak_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    label TEXT NOT NULL DEFAULT 'Snapshot',
    json_blob TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS bak_gltf_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scene_id INTEGER NOT NULL,
    file_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS aud_voice_takes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    scene_id INTEGER,
    audio_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS aud_captions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    animatic_project_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS dlt_commission_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commission_id INTEGER NOT NULL,
    hours REAL NOT NULL DEFAULT 0,
    logged_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS a11y_user_prefs (
    user_id INTEGER PRIMARY KEY,
    focus_mode INTEGER NOT NULL DEFAULT 0,
    dyslexia INTEGER NOT NULL DEFAULT 0,
    colorblind INTEGER NOT NULL DEFAULT 0,
    reduced_motion INTEGER NOT NULL DEFAULT 0,
    large_touch INTEGER NOT NULL DEFAULT 0,
    audio_cues INTEGER NOT NULL DEFAULT 0
  );
`);

for (const statement of [
  `ALTER TABLE a11y_user_prefs ADD COLUMN large_touch INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE a11y_user_prefs ADD COLUMN audio_cues INTEGER NOT NULL DEFAULT 0`,
]) {
  try {
    sqlite.exec(statement);
  } catch {
    // Existing databases already have the column.
  }
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS challenge_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS challenge_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    image_url TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS challenge_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    sticker TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
// ================================

sqlite.exec(`
CREATE TABLE IF NOT EXISTS studio_render_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  minutes REAL NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS studio_render_budget (
  project_id INTEGER PRIMARY KEY,
  total_minutes REAL NOT NULL DEFAULT 600,
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS studio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  parent_id INTEGER,
  notes TEXT,
  restored_from_id INTEGER,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS studio_credit_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  section TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  order_idx INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ''
);
`);

sqlite.exec(`
CREATE TABLE IF NOT EXISTS biz_festivals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  fee REAL DEFAULT 0,
  notes TEXT,
  project_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS biz_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS biz_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  project_id INTEGER,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  notes TEXT,
  receipt_url TEXT,
  created_at TEXT NOT NULL
);
`);

// ============================================================
// v4 storage methods (append to export object below)
// ============================================================

// Extend the storage object with v4 methods
Object.assign(storage, {
  // v4 AI Keys
  async getProjectAiKey: (projectId: number) =>
    await db.select().from(projectAiKeys).where(eq(projectAiKeys.projectId, projectId)).then(r => r[0]),
  async setProjectAiKey: (projectId: number, encryptedKey: string, model: string | null = null): ProjectAiKey => {
    const existing = await db.select().from(projectAiKeys).where(eq(projectAiKeys.projectId, projectId)).then(r => r[0]);
    if (existing) {
      return await db.update(projectAiKeys).set({ encryptedKey, model }).where(eq(projectAiKeys.projectId, projectId)).returning().then(r => r[0])!;
    }
    return await db.insert(projectAiKeys).values({ projectId, encryptedKey, model, createdAt: new Date() }).returning().then(r => r[0]);
  },
  async deleteProjectAiKey: (projectId: number) =>
    await db.delete(projectAiKeys).where(eq(projectAiKeys.projectId, projectId)),

  // v4 AI Agent Chat
  async listAiChatSessions: (projectId: number): AiChatSession[] =>
    await db.select().from(aiChatSessions).where(eq(aiChatSessions.projectId, projectId)).orderBy(desc(aiChatSessions.createdAt)),
  async getAiChatSession: (id: number): AiChatSession | undefined =>
    await db.select().from(aiChatSessions).where(eq(aiChatSessions.id, id)).then(r => r[0]),
  async createAiChatSession: (data: InsertAiChatSession): AiChatSession =>
    await db.insert(aiChatSessions).values({ ...data, createdAt: new Date() }).returning().then(r => r[0]),
  async deleteAiChatSession: (id: number) => {
    await db.delete(aiChatMessages).where(eq(aiChatMessages.sessionId, id));
    await db.delete(aiChatSessions).where(eq(aiChatSessions.id, id));
  },
  async listAiChatMessages: (sessionId: number): AiChatMessage[] =>
    await db.select().from(aiChatMessages).where(eq(aiChatMessages.sessionId, sessionId)).orderBy(asc(aiChatMessages.id)),
  async createAiChatMessage: (data: InsertAiChatMessage): AiChatMessage =>
    await db.insert(aiChatMessages).values({ ...data, createdAt: new Date() }).returning().then(r => r[0]),

  // v4 Achievements
  async listAchievements: (userId: number): Achievement[] =>
    await db.select().from(achievements).where(eq(achievements.userId, userId)),
  async hasAchievement: (userId: number, code: string): boolean =>
    !!await db.select().from(achievements).where(and(eq(achievements.userId, userId), eq(achievements.code, code))).then(r => r[0]),
  async unlockAchievement: (userId: number, code: string): Achievement =>
    await db.insert(achievements).values({ userId, code, unlockedAt: new Date() }).returning().then(r => r[0]),

  // v4 Panel Pins
  async listPanelPins: (panelId: number): PanelPin[] =>
    await db.select().from(panelPins).where(eq(panelPins.panelId, panelId)),
  async createPanelPin: (p: InsertPanelPin): PanelPin =>
    await db.insert(panelPins).values({ ...p, createdAt: new Date() }).returning().then(r => r[0]),
  async deletePanelPin: (id: number) => await db.delete(panelPins).where(eq(panelPins.id, id)),
  async getPanelPin: (id: number) => await db.select().from(panelPins).where(eq(panelPins.id, id)).then(r => r[0]),

  // v4 Commission Line Items
  async listCommissionLineItems: (commissionId: number): CommissionLineItem[] =>
    await db.select().from(commissionLineItems).where(eq(commissionLineItems.commissionId, commissionId)),
  async createCommissionLineItem: (item: InsertCommissionLineItem): CommissionLineItem =>
    await db.insert(commissionLineItems).values({ ...item, createdAt: new Date() }).returning().then(r => r[0]),
  async updateCommissionLineItem: (id: number, patch: Partial<InsertCommissionLineItem>): CommissionLineItem | undefined =>
    await db.update(commissionLineItems).set(patch).where(eq(commissionLineItems.id, id)).returning().then(r => r[0]),
  async deleteCommissionLineItem: (id: number) => await db.delete(commissionLineItems).where(eq(commissionLineItems.id, id)),
  async updateCommissionQuote: (id: number, quoteCents: number | null, invoicedAt?: string | null) => {
    const patch: any = {};
    if (quoteCents !== undefined) patch.quoteCents = quoteCents;
    if (invoicedAt !== undefined) patch.invoicedAt = invoicedAt;
    return await db.update(commissions).set(patch).where(eq(commissions.id, id)).returning().then(r => r[0]);
  },

  // v4 Inbox Items
  async listInboxItems: (userId: number): InboxItem[] =>
    await db.select().from(inboxItems).where(eq(inboxItems.userId, userId)).orderBy(desc(inboxItems.createdAt)),
  async createInboxItem: (item: InsertInboxItem): InboxItem =>
    await db.insert(inboxItems).values({ ...item, createdAt: new Date() }).returning().then(r => r[0]),
  async updateInboxItem: (id: number, patch: Partial<InsertInboxItem>): InboxItem | undefined =>
    await db.update(inboxItems).set(patch).where(eq(inboxItems.id, id)).returning().then(r => r[0]),
  async deleteInboxItem: (id: number) => await db.delete(inboxItems).where(eq(inboxItems.id, id)),
  async getInboxItem: (id: number) => await db.select().from(inboxItems).where(eq(inboxItems.id, id)).then(r => r[0]),

  // v4 Tags
  async listTags: (userId: number): Tag[] =>
    await db.select().from(tags).where(eq(tags.userId, userId)),
  async createTag: (t: InsertTag): Tag =>
    await db.insert(tags).values(t).returning().then(r => r[0]),
  async updateTag: (id: number, patch: Partial<InsertTag>): Tag | undefined =>
    await db.update(tags).set(patch).where(eq(tags.id, id)).returning().then(r => r[0]),
  async deleteTag: (id: number) => {
    await db.delete(tagAssignments).where(eq(tagAssignments.tagId, id));
    await db.delete(tags).where(eq(tags.id, id));
  },
  async getTag: (id: number) => await db.select().from(tags).where(eq(tags.id, id)).then(r => r[0]),

  // v4 Tag Assignments
  async listTagAssignments: (entityKind: string, entityId: number): TagAssignment[] =>
    await db.select().from(tagAssignments).where(and(eq(tagAssignments.entityKind, entityKind), eq(tagAssignments.entityId, entityId))),
  async createTagAssignment: (a: InsertTagAssignment): TagAssignment =>
    await db.insert(tagAssignments).values(a).returning().then(r => r[0]),
  async deleteTagAssignment: (id: number) => await db.delete(tagAssignments).where(eq(tagAssignments.id, id)),
  async getTagAssignment: (id: number) => await db.select().from(tagAssignments).where(eq(tagAssignments.id, id)).then(r => r[0]),

  // v4 Scene Time Entries
  async listSceneTimeEntries: (sceneId: number): SceneTimeEntry[] =>
    await db.select().from(sceneTimeEntries).where(eq(sceneTimeEntries.sceneId, sceneId)),
  async getActiveTimeEntry: (sceneId: number, userId: number): SceneTimeEntry | undefined =>
    await db.select().from(sceneTimeEntries)
      .where(and(eq(sceneTimeEntries.sceneId, sceneId), eq(sceneTimeEntries.userId, userId)))
      
      .find(e => e.endedAt === null || e.endedAt === undefined),
  async startTimer: (sceneId: number, userId: number): SceneTimeEntry =>
    await db.insert(sceneTimeEntries).values({ sceneId, userId, startedAt: Date.now(), endedAt: null, durationMs: null }).returning().then(r => r[0]),
  async stopTimer: (id: number): SceneTimeEntry | undefined => {
    const entry = await db.select().from(sceneTimeEntries).where(eq(sceneTimeEntries.id, id)).then(r => r[0]);
    if (!entry) return undefined;
    const durationMs = Date.now() - entry.startedAt;
    return await db.update(sceneTimeEntries).set({ endedAt: Date.now(), durationMs }).where(eq(sceneTimeEntries.id, id)).returning().then(r => r[0]);
  },

  // v4 Commission Pricing Presets
  async listCommissionPricingPresets: (projectId: number): CommissionPricingPreset[] =>
    await db.select().from(commissionPricingPresets).where(eq(commissionPricingPresets.projectId, projectId)),
  async createCommissionPricingPreset: (p: InsertCommissionPricingPreset): CommissionPricingPreset =>
    await db.insert(commissionPricingPresets).values({ ...p, createdAt: new Date() }).returning().then(r => r[0]),
  async updateCommissionPricingPreset: (id: number, patch: Partial<InsertCommissionPricingPreset>): CommissionPricingPreset | undefined =>
    await db.update(commissionPricingPresets).set(patch).where(eq(commissionPricingPresets.id, id)).returning().then(r => r[0]),
  async deleteCommissionPricingPreset: (id: number) =>
    await db.delete(commissionPricingPresets).where(eq(commissionPricingPresets.id, id)),

  // v4 Global Search — uses raw SQLite for LIKE queries across user's accessible projects
  async globalSearch: (userId: number, q: string, limit = 20) => {
    const likeQ = `%${q.toLowerCase()}%`;
    // Get user's accessible project IDs
    const memberRows = await db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, userId));
    const ownedProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.ownerId, userId));
    const allIds = memberRows.map(r => r.projectId).concat(ownedProjects.map(r => r.id));
    const projectIds = Array.from(new Set(allIds));
    if (projectIds.length === 0) return { projects: [], scenes: [], scripts: [], assets: [], comments: [] };
    const pIdList = projectIds.join(',');

    const matchedProjects = sqlite.prepare(
      `SELECT * FROM projects WHERE id IN (${pIdList}) AND (lower(title) LIKE ? OR lower(description) LIKE ?) LIMIT ?`
    ).all(likeQ, likeQ, limit) as any[];

    const matchedScenes = sqlite.prepare(
      `SELECT * FROM scenes WHERE project_id IN (${pIdList}) AND (lower(title) LIKE ? OR lower(description) LIKE ? OR lower(number) LIKE ?) LIMIT ?`
    ).all(likeQ, likeQ, likeQ, limit) as any[];

    const matchedScripts = sqlite.prepare(
      `SELECT id, project_id, title, updated_at FROM scripts WHERE project_id IN (${pIdList}) AND (lower(title) LIKE ? OR lower(content) LIKE ?) LIMIT ?`
    ).all(likeQ, likeQ, limit) as any[];

    const matchedAssets = sqlite.prepare(
      `SELECT id, project_id, category, filename, mime_type, thumbnail_data, notes, tags, uploader_id, created_at FROM assets WHERE project_id IN (${pIdList}) AND (lower(filename) LIKE ? OR lower(notes) LIKE ?) LIMIT ?`
    ).all(likeQ, likeQ, limit) as any[];

    const matchedComments = sqlite.prepare(
      `SELECT * FROM comments WHERE project_id IN (${pIdList}) AND lower(body) LIKE ? LIMIT ?`
    ).all(likeQ, limit) as any[];

    return {
      projects: matchedProjects,
      scenes: matchedScenes,
      scripts: matchedScripts,
      assets: matchedAssets,
      comments: matchedComments,
    };
  },

  // v5 Agent 5
  async getCommissionHours: (commissionId: number): DltCommissionHours[] =>
    await db.select().from(dltCommissionHours).where(eq(dltCommissionHours.commissionId, commissionId)),
  async addCommissionHours: (hours: InsertDltCommissionHours): DltCommissionHours =>
    await db.insert(dltCommissionHours).values({ ...hours, loggedAt: new Date() }).returning().then(r => r[0]),
  async createAudVoiceTake: (take: InsertAudVoiceTake) =>
    await db.insert(audVoiceTakes).values(take).returning().then(r => r[0]),
  
  async getAudVoiceTakesByProject: (projectId: number) =>
    await db.select().from(audVoiceTakes).where(eq(audVoiceTakes.projectId, projectId)),
  
  async createAudCaption: (caption: InsertAudCaption) =>
    await db.insert(audCaptions).values(caption).returning().then(r => r[0]),
    
  async getAudCaptionsByAnimatic: (animaticProjectId: number) =>
    await db.select().from(audCaptions).where(eq(audCaptions.animaticProjectId, animaticProjectId)),
    
  async deleteAudCaption: (id: number) =>
    await db.delete(audCaptions).where(eq(audCaptions.id, id)),

  async getCliApprovals: (projectId: number) =>
    await db.select().from(cli_approvals).where(eq(cli_approvals.projectId, projectId)),
  
  async createCliApproval: (data: Partial<typeof cli_approvals.$inferInsert>) =>
    await db.insert(cli_approvals).values(data as any).returning().then(r => r[0]),

  async getCliFeedback: (projectId: number) =>
    await db.select().from(cli_feedback).where(eq(cli_feedback.projectId, projectId)),
    
  async createCliFeedback: (data: Partial<typeof cli_feedback.$inferInsert>) =>
    await db.insert(cli_feedback).values({ ...data, createdAt: new Date() } as any).returning().then(r => r[0]),

  async getA11yPrefs: (userId: number) => 
    await db.select().from(a11y_user_prefs).where(eq(a11y_user_prefs.userId, userId)).then(r => r[0]),
  
  async createA11yPrefs: (prefs: InsertA11yPrefs) => 
    await db.insert(a11y_user_prefs).values(prefs).returning().then(r => r[0]),
  
  async updateA11yPrefs: (userId: number, patch: Partial<InsertA11yPrefs>) => {
    const existing = await db.select().from(a11y_user_prefs).where(eq(a11y_user_prefs.userId, userId)).then(r => r[0]);
    if (existing) {
      return await db.update(a11y_user_prefs).set(patch).where(eq(a11y_user_prefs.userId, userId)).returning().then(r => r[0]);
    }
    return await db.insert(a11y_user_prefs).values({
      userId,
      focusMode: patch.focusMode || 0,
      dyslexia: patch.dyslexia || 0,
      colorblind: patch.colorblind || 0,
      reducedMotion: patch.reducedMotion || 0,
      largeTouch: patch.largeTouch || 0,
      audioCues: patch.audioCues || 0,
    }).returning().then(r => r[0]);
  },

  async listChallengePrompts: () => await db.select().from(challenge_prompts).orderBy(desc(challenge_prompts.weekNumber)),
  
  async listChallengeSubmissions: (userId: number) => await db.select().from(challenge_submissions).where(eq(challenge_submissions.userId, userId)),

  async createChallengeSubmission: (submission: InsertChallengeSubmission & { userId: number }) => 
    await db.insert(challenge_submissions).values({ ...submission, createdAt: new Date() }).returning().then(r => r[0]),

  async listChallengeFeed: (userId: number) => {
    const prompts = await db.select().from(challenge_prompts);
    const submissions = await db.select().from(challenge_submissions).orderBy(desc(challenge_submissions.createdAt));
    const reactions = await db.select().from(challenge_reactions);
    return submissions.map((submission) => {
      const counts = reactions
        .filter((reaction) => reaction.submissionId === submission.id)
        .reduce<Record<string, number>>((acc, reaction) => {
          acc[reaction.sticker] = (acc[reaction.sticker] || 0) + 1;
          return acc;
        }, {});
      return {
        ...submission,
        prompt: prompts.find((prompt) => prompt.id === submission.promptId) || null,
        reactionCounts: counts,
        myReaction: reactions.find((reaction) => reaction.submissionId === submission.id && reaction.userId === userId)?.sticker || null,
      };
    });
  },

  async toggleChallengeReaction: (submissionId: number, userId: number, sticker: string): { active: boolean; reaction?: ChallengeReaction } => {
    const submission = await db.select().from(challenge_submissions).where(eq(challenge_submissions.id, submissionId)).then(r => r[0]);
    if (!submission) throw new Error("Submission not found");
    const existing = await db.select().from(challenge_reactions).where(and(
      eq(challenge_reactions.submissionId, submissionId),
      eq(challenge_reactions.userId, userId),
    )).then(r => r[0]);
    if (existing?.sticker === sticker) {
      await db.delete(challenge_reactions).where(eq(challenge_reactions.id, existing.id));
      return { active: false };
    }
    if (existing) {
      const updated = await db.update(challenge_reactions)
        .set({ sticker, createdAt: new Date() })
        .where(eq(challenge_reactions.id, existing.id))
        .returning()
        .then(r => r[0]);
      return { active: true, reaction: updated };
    }
    const reaction = await db.insert(challenge_reactions).values({
      submissionId,
      userId,
      sticker,
      createdAt: new Date(),
    }).returning().then(r => r[0]);
    return { active: true, reaction };
  },

  // Studio Render Budget
  async getStudioRenderBudget: (projectId: number): StudioRenderBudget | undefined =>
    await db.select().from(studio_render_budget).where(eq(studio_render_budget.projectId, projectId)).then(r => r[0]),
  async upsertStudioRenderBudget: (projectId: number, totalMinutes: number): StudioRenderBudget => {
    const existing = await db.select().from(studio_render_budget).where(eq(studio_render_budget.projectId, projectId)).then(r => r[0]);
    const now = new Date();
    if (existing) {
      return await db.update(studio_render_budget).set({ totalMinutes, updatedAt: now }).where(eq(studio_render_budget.projectId, projectId)).returning().then(r => r[0])!;
    }
    return await db.insert(studio_render_budget).values({ projectId, totalMinutes, updatedAt: now }).returning().then(r => r[0]);
  },

  // Studio Render Events
  async listStudioRenderEvents: (projectId: number): StudioRenderEvent[] =>
    await db.select().from(studio_render_events).where(eq(studio_render_events.projectId, projectId)).orderBy(asc(studio_render_events.createdAt)),
  async createStudioRenderEvent: (data: InsertStudioRenderEvent): StudioRenderEvent =>
    await db.insert(studio_render_events).values({ ...data, createdAt: new Date() }).returning().then(r => r[0]),
  async deleteStudioRenderEvent: (id: number) =>
    await db.delete(studio_render_events).where(eq(studio_render_events.id, id)),

  // Studio Snapshots
  async listStudioSnapshots: (projectId: number): StudioSnapshot[] =>
    await db.select().from(studio_snapshots).where(eq(studio_snapshots.projectId, projectId)).orderBy(asc(studio_snapshots.createdAt)),
  async createStudioSnapshot: (data: InsertStudioSnapshot): StudioSnapshot =>
    await db.insert(studio_snapshots).values({ ...data, createdAt: new Date() }).returning().then(r => r[0]),
  async deleteStudioSnapshot: (id: number) =>
    await db.delete(studio_snapshots).where(eq(studio_snapshots.id, id)),
  async getStudioSnapshot: (id: number): StudioSnapshot | undefined =>
    await db.select().from(studio_snapshots).where(eq(studio_snapshots.id, id)).then(r => r[0]),
  async restoreStudioSnapshot: (snapshotId: number, projectId: number): StudioSnapshot =>
    await db.insert(studio_snapshots).values({
      projectId,
      label: `Restored from #${snapshotId}`,
      parentId: snapshotId,
      restoredFromId: snapshotId,
      createdAt: new Date(),
    }).returning().then(r => r[0]),

  // Studio Credit Entries
  async listStudioCreditEntries: (projectId: number): StudioCreditEntry[] =>
    await db.select().from(studio_credit_entries).where(eq(studio_credit_entries.projectId, projectId)).orderBy(asc(studio_credit_entries.orderIdx)),
  async createStudioCreditEntry: (data: InsertStudioCreditEntry): StudioCreditEntry =>
    await db.insert(studio_credit_entries).values({ ...data, createdAt: new Date() }).returning().then(r => r[0]),
  async updateStudioCreditEntry: (id: number, patch: Partial<InsertStudioCreditEntry>): StudioCreditEntry | undefined =>
    await db.update(studio_credit_entries).set(patch).where(eq(studio_credit_entries.id, id)).returning().then(r => r[0]),
  async deleteStudioCreditEntry: (id: number) =>
    await db.delete(studio_credit_entries).where(eq(studio_credit_entries.id, id)),
  async replaceStudioCreditEntries: (projectId: number, entries: InsertStudioCreditEntry[]): StudioCreditEntry[] => {
    await db.delete(studio_credit_entries).where(eq(studio_credit_entries.projectId, projectId));
    const now = new Date();
    const result: StudioCreditEntry[] = [];
    for (const e of entries) {
      result.push(await db.insert(studio_credit_entries).values({ ...e, createdAt: now }).returning().then(r => r[0]));
    }
    return result;
  },

  // === LORE ADDITIONS START ===
  async listLorFacts: (projectId: number): LorContinuityFact[] =>
    await db.select().from(lor_continuity_facts).where(eq(lor_continuity_facts.projectId, projectId)),
  async createLorFact: (f: InsertLorContinuityFact): LorContinuityFact =>
    await db.insert(lor_continuity_facts).values({ ...f, createdAt: new Date() }).returning().then(r => r[0]),
  async updateLorFact: (id: number, patch: Partial<InsertLorContinuityFact>): LorContinuityFact | undefined =>
    await db.update(lor_continuity_facts).set(patch).where(eq(lor_continuity_facts.id, id)).returning().then(r => r[0]),
  async deleteLorFact: (id: number) => await db.delete(lor_continuity_facts).where(eq(lor_continuity_facts.id, id)),
  async getLorFact: (id: number): LorContinuityFact | undefined =>
    await db.select().from(lor_continuity_facts).where(eq(lor_continuity_facts.id, id)).then(r => r[0]),

  async listLorPalettes: (projectId: number): LorPalette[] =>
    await db.select().from(lor_palettes).where(eq(lor_palettes.projectId, projectId)),
  async createLorPalette: (p: InsertLorPalette): LorPalette =>
    await db.insert(lor_palettes).values({ ...p, createdAt: new Date() }).returning().then(r => r[0]),
  async deleteLorPalette: (id: number) => await db.delete(lor_palettes).where(eq(lor_palettes.id, id)),
  async getLorPalette: (id: number): LorPalette | undefined =>
    await db.select().from(lor_palettes).where(eq(lor_palettes.id, id)).then(r => r[0]),

  async listLorAssetVersions: (assetId: number): LorAssetVersion[] =>
    await db.select().from(lor_asset_versions).where(eq(lor_asset_versions.assetId, assetId)).orderBy(desc(lor_asset_versions.versionNum)),
  async createLorAssetVersion: (v: InsertLorAssetVersion): LorAssetVersion =>
    await db.insert(lor_asset_versions).values({ ...v, uploadedAt: new Date() }).returning().then(r => r[0]),
  async updateLorAssetVersionsForAsset: (assetId: number, patch: Partial<LorAssetVersion>) =>
    await db.update(lor_asset_versions).set(patch).where(eq(lor_asset_versions.assetId, assetId)),
  async updateLorAssetVersion: (id: number, patch: Partial<LorAssetVersion>): LorAssetVersion | undefined =>
    await db.update(lor_asset_versions).set(patch).where(eq(lor_asset_versions.id, id)).returning().then(r => r[0]),
  async getLorAssetVersion: (id: number): LorAssetVersion | undefined =>
    await db.select().from(lor_asset_versions).where(eq(lor_asset_versions.id, id)).then(r => r[0]),

  async listLorCasting: (projectId: number): LorCastingMatrix[] =>
    await db.select().from(lor_casting_matrix).where(eq(lor_casting_matrix.projectId, projectId)),
  async upsertLorCasting: (projectId: number, sceneId: number, entityId: number, present: boolean) => {
    const existing = await db.select().from(lor_casting_matrix).where(
      and(
        eq(lor_casting_matrix.projectId, projectId),
        eq(lor_casting_matrix.sceneId, sceneId),
        eq(lor_casting_matrix.entityId, entityId)
      )
    ).then(r => r[0]);
    if (existing) {
      return await db.update(lor_casting_matrix).set({ present }).where(eq(lor_casting_matrix.id, existing.id));
    } else {
      return await db.insert(lor_casting_matrix).values({ projectId, sceneId, entityId, present });
    }
  },
  // === LORE ADDITIONS END ===
});

export type Storage = typeof storage;
