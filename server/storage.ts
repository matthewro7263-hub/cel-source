import {
  users, projects, projectMembers, scripts, storyboards, storyboardPanels,
  animatics, scenes, comments, assets, commissions, renders,
  animaticProjects, animaticTracks, animaticClips,
} from "@shared/schema";
import type {
  User, InsertUser, Project, InsertProject, ProjectMember, InsertProjectMember,
  Script, InsertScript, Storyboard, InsertStoryboard, Panel, InsertPanel,
  Animatic, InsertAnimatic, Scene, InsertScene, Comment, InsertComment,
  Asset, InsertAsset, Commission, InsertCommission, Render, InsertRender,
  AnimaticProject, InsertAnimaticProject, AnimaticTrack, InsertAnimaticTrack,
  AnimaticClip, InsertAnimaticClip,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, or, inArray, asc, desc, like } from "drizzle-orm";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import {
  projectAiKeys, achievements, panelPins,
  commissionLineItems, inboxItems, tags, tagAssignments,
  sceneTimeEntries, commissionPricingPresets,
  audVoiceTakes, audCaptions,
  dltCommissionHours,
  // === AGENT_1 ADDITIONS START ===
  cli_approvals, cli_feedback,
  // === AGENT_1 ADDITIONS END ===
} from "@shared/schema";
import { a11y_user_prefs } from "@shared/a11y_schema";
import { challenge_prompts, challenge_reactions, challenge_submissions } from "@shared/challenge_schema";
import { lor_continuity_facts, lor_palettes, lor_asset_versions, lor_casting_matrix } from "@shared/lor_schema";

import type {
  ProjectAiKey, InsertProjectAiKey,
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
import type { A11yPrefs, InsertA11yPrefs } from "@shared/a11y_schema";
import type { ChallengePrompt, ChallengeReaction, ChallengeSubmission, InsertChallengeSubmission } from "@shared/challenge_schema";
import type {
  LorContinuityFact, InsertLorContinuityFact,
  LorPalette, InsertLorPalette,
  LorAssetVersion, InsertLorAssetVersion,
  LorCastingMatrix, InsertLorCastingMatrix,
} from "@shared/lor_schema";

// === AGENT_STUDIO ADDITIONS START ===
import {
  studio_render_events, studio_render_budget, studio_snapshots, studio_credit_entries,
} from "@shared/studio_schema";
import type {
  StudioRenderEvent, InsertStudioRenderEvent,
  StudioRenderBudget,
  StudioSnapshot, InsertStudioSnapshot,
  StudioCreditEntry, InsertStudioCreditEntry,
} from "@shared/studio_schema";
// === AGENT_STUDIO ADDITIONS END ===

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Create tables (idempotent via Drizzle raw exec)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#6E4FE8',
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_color TEXT NOT NULL DEFAULT '#6E4FE8',
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  share_token TEXT NOT NULL,
  share_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT '',
  cli_brand_logo TEXT,
  cli_brand_color TEXT NOT NULL DEFAULT '#9DD0FF',
  cli_brand_welcome TEXT
);
CREATE TABLE IF NOT EXISTS project_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor'
);
CREATE TABLE IF NOT EXISTS scripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Script',
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS storyboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'Storyboard',
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS storyboard_panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  storyboard_id INTEGER NOT NULL,
  order_idx INTEGER NOT NULL DEFAULT 0,
  image_data TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  dialogue TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS animatics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'Animatic',
  video_data TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS scenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  number TEXT NOT NULL DEFAULT '1',
  title TEXT NOT NULL DEFAULT 'Untitled Scene',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'script',
  deadline TEXT,
  assignee_id INTEGER
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  scene_id INTEGER,
  author_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  file_data TEXT NOT NULL,
  thumbnail_data TEXT,
  notes TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  uploader_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  reference_image TEXT,
  deadline TEXT,
  budget_range TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT NOT NULL DEFAULT '',
  linked_project_id INTEGER,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS renders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT 'Render',
  status TEXT NOT NULL DEFAULT 'queued',
  software TEXT NOT NULL DEFAULT 'Other',
  duration_seconds INTEGER,
  file_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS animatic_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Animatic',
  fps INTEGER NOT NULL DEFAULT 24,
  total_duration_ms INTEGER NOT NULL DEFAULT 8000,
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS animatic_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animatic_project_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'panel',
  name TEXT NOT NULL DEFAULT 'Track',
  order_idx INTEGER NOT NULL DEFAULT 0,
  muted INTEGER NOT NULL DEFAULT 0,
  volume TEXT NOT NULL DEFAULT '1.0'
);
CREATE TABLE IF NOT EXISTS animatic_clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL,
  start_ms INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 2000,
  source_kind TEXT NOT NULL DEFAULT 'panel_ref',
  source_id INTEGER,
  audio_data_url TEXT,
  label TEXT NOT NULL DEFAULT '',
  fade_in_ms INTEGER NOT NULL DEFAULT 0,
  fade_out_ms INTEGER NOT NULL DEFAULT 0,
  volume TEXT NOT NULL DEFAULT '1.0'
);
CREATE TABLE IF NOT EXISTS lor_continuity_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'character',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  image_data TEXT,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS lor_palettes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'Palette',
  colors TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS lor_asset_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  version_num INTEGER NOT NULL,
  file_data TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS lor_casting_matrix (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  scene_id INTEGER NOT NULL,
  entity_id INTEGER NOT NULL,
  present INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audio2_lipsync (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  transcript TEXT NOT NULL,
  timeline_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audio2_cues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#9DD0FF',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approval_signoffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  milestone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approver_name TEXT,
  signature TEXT,
  signature_hash TEXT,
  notes TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT ''
);
`);

// ===== PASSWORD UTILS =====
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = scryptSync(password, salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
  } catch {
    return false;
  }
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
  getUser: (id: number) => db.select().from(users).where(eq(users.id, id)).get(),
  getUserByEmail: (email: string) => db.select().from(users).where(eq(users.email, email)).get(),
  createUser: (u: InsertUser) => db.insert(users).values(u).returning().get(),
  updateUser: (id: number, patch: Partial<InsertUser>) =>
    db.update(users).set(patch).where(eq(users.id, id)).returning().get(),

  // ===== PROJECTS =====
  listProjectsForUser: (userId: number): Project[] => {
    const memberRows = db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId))
      .all();
    const ids = memberRows.map((r) => r.projectId);
    if (ids.length === 0) {
      return db.select().from(projects).where(eq(projects.ownerId, userId)).all();
    }
    return db
      .select()
      .from(projects)
      .where(or(eq(projects.ownerId, userId), inArray(projects.id, ids)))
      .all();
  },
  getProject: (id: number) => db.select().from(projects).where(eq(projects.id, id)).get(),
  getProjectByToken: (token: string) =>
    db.select().from(projects).where(eq(projects.shareToken, token)).get(),
  createProject: (p: InsertProject): Project => {
    const row = db.insert(projects).values({ ...p, createdAt: new Date().toISOString() }).returning().get();
    return row;
  },
  updateProject: (id: number, patch: Partial<InsertProject>) =>
    db.update(projects).set(patch).where(eq(projects.id, id)).returning().get(),
  deleteProject: (id: number) => {
    db.delete(comments).where(eq(comments.projectId, id)).run();
    db.delete(scenes).where(eq(scenes.projectId, id)).run();
    const sbs = db.select().from(storyboards).where(eq(storyboards.projectId, id)).all();
    for (const sb of sbs) db.delete(storyboardPanels).where(eq(storyboardPanels.storyboardId, sb.id)).run();
    db.delete(storyboards).where(eq(storyboards.projectId, id)).run();
    db.delete(animatics).where(eq(animatics.projectId, id)).run();
    db.delete(scripts).where(eq(scripts.projectId, id)).run();
    db.delete(projectMembers).where(eq(projectMembers.projectId, id)).run();
    db.delete(projects).where(eq(projects.id, id)).run();
  },

  // ===== MEMBERS =====
  listMembers: (projectId: number): (ProjectMember & { user: User })[] => {
    const rows = db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId)).all();
    return rows.map((r) => ({ ...r, user: db.select().from(users).where(eq(users.id, r.userId)).get()! }));
  },
  addMember: (m: InsertProjectMember) => db.insert(projectMembers).values(m).returning().get(),
  removeMember: (projectId: number, userId: number) =>
    db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).run(),
  isMember: (projectId: number, userId: number): boolean => {
    const row = db.select().from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).get();
    return !!row;
  },

  // ===== SCRIPTS =====
  listScripts: (projectId: number) => db.select().from(scripts).where(eq(scripts.projectId, projectId)).all(),
  getScript: (id: number) => db.select().from(scripts).where(eq(scripts.id, id)).get(),
  createScript: (s: InsertScript) => db.insert(scripts).values({ ...s, updatedAt: new Date().toISOString() }).returning().get(),
  updateScript: (id: number, patch: Partial<InsertScript>) =>
    db.update(scripts).set({ ...patch, updatedAt: new Date().toISOString() }).where(eq(scripts.id, id)).returning().get(),
  deleteScript: (id: number) => db.delete(scripts).where(eq(scripts.id, id)).run(),

  // ===== STORYBOARDS =====
  listStoryboards: (projectId: number) => db.select().from(storyboards).where(eq(storyboards.projectId, projectId)).all(),
  getStoryboard: (id: number) => db.select().from(storyboards).where(eq(storyboards.id, id)).get(),
  createStoryboard: (s: InsertStoryboard) =>
    db.insert(storyboards).values({ ...s, createdAt: new Date().toISOString() }).returning().get(),
  deleteStoryboard: (id: number) => {
    db.delete(storyboardPanels).where(eq(storyboardPanels.storyboardId, id)).run();
    db.delete(storyboards).where(eq(storyboards.id, id)).run();
  },

  // ===== PANELS =====
  listPanels: (storyboardId: number) =>
    db.select().from(storyboardPanels).where(eq(storyboardPanels.storyboardId, storyboardId)).orderBy(asc(storyboardPanels.orderIdx)).all(),
  createPanel: (p: InsertPanel) => db.insert(storyboardPanels).values(p).returning().get(),
  updatePanel: (id: number, patch: Partial<InsertPanel>) =>
    db.update(storyboardPanels).set(patch).where(eq(storyboardPanels.id, id)).returning().get(),
  deletePanel: (id: number) => db.delete(storyboardPanels).where(eq(storyboardPanels.id, id)).run(),
  getPanel: (id: number) => db.select().from(storyboardPanels).where(eq(storyboardPanels.id, id)).get(),

  // ===== ANIMATICS =====
  listAnimatics: (projectId: number) => db.select().from(animatics).where(eq(animatics.projectId, projectId)).all(),
  createAnimatic: (a: InsertAnimatic) =>
    db.insert(animatics).values({ ...a, createdAt: new Date().toISOString() }).returning().get(),
  deleteAnimatic: (id: number) => db.delete(animatics).where(eq(animatics.id, id)).run(),

  // ===== SCENES =====
  listScenes: (projectId: number) => db.select().from(scenes).where(eq(scenes.projectId, projectId)).all(),
  getScene: (id: number) => db.select().from(scenes).where(eq(scenes.id, id)).get(),
  createScene: (s: InsertScene) => db.insert(scenes).values(s).returning().get(),
  updateScene: (id: number, patch: Partial<InsertScene>) =>
    db.update(scenes).set(patch).where(eq(scenes.id, id)).returning().get(),
  deleteScene: (id: number) => db.delete(scenes).where(eq(scenes.id, id)).run(),

  // ===== COMMENTS =====
  listComments: (projectId: number) =>
    db.select().from(comments).where(eq(comments.projectId, projectId)).orderBy(desc(comments.createdAt)).all(),
  createComment: (c: InsertComment) =>
    db.insert(comments).values({ ...c, createdAt: new Date().toISOString() }).returning().get(),
  deleteComment: (id: number) => db.delete(comments).where(eq(comments.id, id)).run(),

  // ===== ASSETS =====
  listAssets: (projectId: number, category?: string): Asset[] => {
    if (category) {
      return db.select().from(assets).where(and(eq(assets.projectId, projectId), eq(assets.category, category))).orderBy(desc(assets.createdAt)).all();
    }
    return db.select().from(assets).where(eq(assets.projectId, projectId)).orderBy(desc(assets.createdAt)).all();
  },
  getAsset: (id: number) => db.select().from(assets).where(eq(assets.id, id)).get(),
  createAsset: (a: InsertAsset): Asset =>
    db.insert(assets).values({ ...a, createdAt: new Date().toISOString() }).returning().get(),
  updateAsset: (id: number, patch: Partial<Pick<InsertAsset, 'notes' | 'tags' | 'category'>>) =>
    db.update(assets).set(patch).where(eq(assets.id, id)).returning().get(),
  deleteAsset: (id: number) => db.delete(assets).where(eq(assets.id, id)).run(),

  // ===== COMMISSIONS =====
  listCommissions: (ownerUserId: number): Commission[] =>
    db.select().from(commissions).where(eq(commissions.ownerUserId, ownerUserId)).orderBy(asc(commissions.status), desc(commissions.createdAt)).all(),
  getCommission: (id: number) => db.select().from(commissions).where(eq(commissions.id, id)).get(),
  createCommission: (c: InsertCommission): Commission =>
    db.insert(commissions).values({ ...c, createdAt: new Date().toISOString() }).returning().get(),
  updateCommission: (id: number, patch: Partial<Pick<Commission, 'status' | 'notes' | 'linkedProjectId'>>) =>
    db.update(commissions).set(patch).where(eq(commissions.id, id)).returning().get(),

  // ===== RENDERS =====
  listRenders: (sceneId: number): Render[] =>
    db.select().from(renders).where(eq(renders.sceneId, sceneId)).orderBy(desc(renders.createdAt)).all(),
  getRender: (id: number) => db.select().from(renders).where(eq(renders.id, id)).get(),
  createRender: (r: InsertRender): Render =>
    db.insert(renders).values({ ...r, createdAt: new Date().toISOString() }).returning().get(),
  updateRender: (id: number, patch: Partial<InsertRender>) =>
    db.update(renders).set(patch).where(eq(renders.id, id)).returning().get(),
  deleteRender: (id: number) => db.delete(renders).where(eq(renders.id, id)).run(),

  // ===== ANIMATIC PROJECTS (v2) =====
  getAnimaticProjectsByProject: (projectId: number): AnimaticProject[] =>
    db.select().from(animaticProjects).where(eq(animaticProjects.projectId, projectId)).orderBy(desc(animaticProjects.createdAt)).all(),

  getAnimaticProject: (id: number) => {
    const ap = db.select().from(animaticProjects).where(eq(animaticProjects.id, id)).get();
    if (!ap) return undefined;
    const tracks = db.select().from(animaticTracks).where(eq(animaticTracks.animaticProjectId, id)).orderBy(asc(animaticTracks.orderIdx)).all();
    const allClips = tracks.length > 0
      ? db.select().from(animaticClips).where(inArray(animaticClips.trackId, tracks.map(t => t.id))).all()
      : [];
    const tracksWithClips = tracks.map(t => ({
      ...t,
      clips: allClips.filter(c => c.trackId === t.id).sort((a, b) => a.startMs - b.startMs),
    }));
    return { ...ap, tracks: tracksWithClips };
  },

  createAnimaticProject: (data: InsertAnimaticProject): AnimaticProject => {
    const now = new Date().toISOString();
    const ap = db.insert(animaticProjects).values({ ...data, createdAt: now, updatedAt: now }).returning().get();
    // Create 4 default tracks
    const defaultTracks: { kind: string; name: string; orderIdx: number }[] = [
      { kind: "panel", name: "Panels", orderIdx: 0 },
      { kind: "voice", name: "Voice", orderIdx: 1 },
      { kind: "sfx", name: "SFX", orderIdx: 2 },
      { kind: "music", name: "Music", orderIdx: 3 },
    ];
    for (const t of defaultTracks) {
      db.insert(animaticTracks).values({ animaticProjectId: ap.id, kind: t.kind, name: t.name, orderIdx: t.orderIdx, muted: false, volume: "1.0" }).run();
    }
    return ap;
  },

  updateAnimaticProject: (id: number, patch: Partial<InsertAnimaticProject>) =>
    db.update(animaticProjects).set({ ...patch, updatedAt: new Date().toISOString() }).where(eq(animaticProjects.id, id)).returning().get(),

  deleteAnimaticProject: (id: number) => {
    const tracks = db.select().from(animaticTracks).where(eq(animaticTracks.animaticProjectId, id)).all();
    for (const t of tracks) {
      db.delete(animaticClips).where(eq(animaticClips.trackId, t.id)).run();
    }
    db.delete(animaticTracks).where(eq(animaticTracks.animaticProjectId, id)).run();
    db.delete(animaticProjects).where(eq(animaticProjects.id, id)).run();
  },

  // ===== ANIMATIC TRACKS =====
  createTrack: (data: InsertAnimaticTrack): AnimaticTrack =>
    db.insert(animaticTracks).values(data).returning().get(),

  updateTrack: (id: number, patch: Partial<InsertAnimaticTrack>) =>
    db.update(animaticTracks).set(patch).where(eq(animaticTracks.id, id)).returning().get(),

  deleteTrack: (id: number) => {
    db.delete(animaticClips).where(eq(animaticClips.trackId, id)).run();
    db.delete(animaticTracks).where(eq(animaticTracks.id, id)).run();
  },

  getTrack: (id: number) => db.select().from(animaticTracks).where(eq(animaticTracks.id, id)).get(),

  // ===== ANIMATIC CLIPS =====
  createClip: (data: InsertAnimaticClip): AnimaticClip =>
    db.insert(animaticClips).values(data).returning().get(),

  updateClip: (id: number, patch: Partial<InsertAnimaticClip>) =>
    db.update(animaticClips).set(patch).where(eq(animaticClips.id, id)).returning().get(),

  deleteClip: (id: number) => db.delete(animaticClips).where(eq(animaticClips.id, id)).run(),

  getClip: (id: number) => db.select().from(animaticClips).where(eq(animaticClips.id, id)).get(),

  // raw access for seed
  _db: db,
};

export type Storage = typeof storage;

// ============================================================
// v4 — table creation and extensions
// ============================================================
// Create v4 tables (idempotent)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS project_ai_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  encrypted_key TEXT NOT NULL,
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

// ===== v5 bak modifications =====
try { sqlite.exec(`ALTER TABLE scripts ADD COLUMN deleted_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE storyboard_panels ADD COLUMN deleted_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE scenes ADD COLUMN deleted_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE assets ADD COLUMN deleted_at TEXT`); } catch {}

// v5 Agent 5
try { sqlite.exec(`ALTER TABLE projects ADD COLUMN dlt_discord_webhook_url TEXT`); } catch {}

// === AGENT_1 ADDITIONS START ===
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
// === AGENT_1 ADDITIONS END ===

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
// === AGENT_STUDIO ADDITIONS END ===

// === AGENT_BIZ ADDITIONS START ===
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
// === AGENT_BIZ ADDITIONS END ===

// ============================================================
// v4 storage methods (append to export object below)
// ============================================================

// Extend the storage object with v4 methods
Object.assign(storage, {
  // v4 AI Keys
  getProjectAiKey: (projectId: number) =>
    db.select().from(projectAiKeys).where(eq(projectAiKeys.projectId, projectId)).get(),
  setProjectAiKey: (projectId: number, encryptedKey: string, model: string | null = null): ProjectAiKey => {
    const existing = db.select().from(projectAiKeys).where(eq(projectAiKeys.projectId, projectId)).get();
    if (existing) {
      return db.update(projectAiKeys).set({ encryptedKey, model }).where(eq(projectAiKeys.projectId, projectId)).returning().get()!;
    }
    return db.insert(projectAiKeys).values({ projectId, encryptedKey, model, createdAt: new Date().toISOString() }).returning().get();
  },
  deleteProjectAiKey: (projectId: number) =>
    db.delete(projectAiKeys).where(eq(projectAiKeys.projectId, projectId)).run(),

  // v4 Achievements
  listAchievements: (userId: number): Achievement[] =>
    db.select().from(achievements).where(eq(achievements.userId, userId)).all(),
  hasAchievement: (userId: number, code: string): boolean =>
    !!db.select().from(achievements).where(and(eq(achievements.userId, userId), eq(achievements.code, code))).get(),
  unlockAchievement: (userId: number, code: string): Achievement =>
    db.insert(achievements).values({ userId, code, unlockedAt: new Date().toISOString() }).returning().get(),

  // v4 Panel Pins
  listPanelPins: (panelId: number): PanelPin[] =>
    db.select().from(panelPins).where(eq(panelPins.panelId, panelId)).all(),
  createPanelPin: (p: InsertPanelPin): PanelPin =>
    db.insert(panelPins).values({ ...p, createdAt: new Date().toISOString() }).returning().get(),
  deletePanelPin: (id: number) => db.delete(panelPins).where(eq(panelPins.id, id)).run(),
  getPanelPin: (id: number) => db.select().from(panelPins).where(eq(panelPins.id, id)).get(),

  // v4 Commission Line Items
  listCommissionLineItems: (commissionId: number): CommissionLineItem[] =>
    db.select().from(commissionLineItems).where(eq(commissionLineItems.commissionId, commissionId)).all(),
  createCommissionLineItem: (item: InsertCommissionLineItem): CommissionLineItem =>
    db.insert(commissionLineItems).values({ ...item, createdAt: new Date().toISOString() }).returning().get(),
  updateCommissionLineItem: (id: number, patch: Partial<InsertCommissionLineItem>): CommissionLineItem | undefined =>
    db.update(commissionLineItems).set(patch).where(eq(commissionLineItems.id, id)).returning().get(),
  deleteCommissionLineItem: (id: number) => db.delete(commissionLineItems).where(eq(commissionLineItems.id, id)).run(),
  updateCommissionQuote: (id: number, quoteCents: number | null, invoicedAt?: string | null) => {
    const patch: any = {};
    if (quoteCents !== undefined) patch.quoteCents = quoteCents;
    if (invoicedAt !== undefined) patch.invoicedAt = invoicedAt;
    return db.update(commissions).set(patch).where(eq(commissions.id, id)).returning().get();
  },

  // v4 Inbox Items
  listInboxItems: (userId: number): InboxItem[] =>
    db.select().from(inboxItems).where(eq(inboxItems.userId, userId)).orderBy(desc(inboxItems.createdAt)).all(),
  createInboxItem: (item: InsertInboxItem): InboxItem =>
    db.insert(inboxItems).values({ ...item, createdAt: new Date().toISOString() }).returning().get(),
  updateInboxItem: (id: number, patch: Partial<InsertInboxItem>): InboxItem | undefined =>
    db.update(inboxItems).set(patch).where(eq(inboxItems.id, id)).returning().get(),
  deleteInboxItem: (id: number) => db.delete(inboxItems).where(eq(inboxItems.id, id)).run(),
  getInboxItem: (id: number) => db.select().from(inboxItems).where(eq(inboxItems.id, id)).get(),

  // v4 Tags
  listTags: (userId: number): Tag[] =>
    db.select().from(tags).where(eq(tags.userId, userId)).all(),
  createTag: (t: InsertTag): Tag =>
    db.insert(tags).values(t).returning().get(),
  updateTag: (id: number, patch: Partial<InsertTag>): Tag | undefined =>
    db.update(tags).set(patch).where(eq(tags.id, id)).returning().get(),
  deleteTag: (id: number) => {
    db.delete(tagAssignments).where(eq(tagAssignments.tagId, id)).run();
    db.delete(tags).where(eq(tags.id, id)).run();
  },
  getTag: (id: number) => db.select().from(tags).where(eq(tags.id, id)).get(),

  // v4 Tag Assignments
  listTagAssignments: (entityKind: string, entityId: number): TagAssignment[] =>
    db.select().from(tagAssignments).where(and(eq(tagAssignments.entityKind, entityKind), eq(tagAssignments.entityId, entityId))).all(),
  createTagAssignment: (a: InsertTagAssignment): TagAssignment =>
    db.insert(tagAssignments).values(a).returning().get(),
  deleteTagAssignment: (id: number) => db.delete(tagAssignments).where(eq(tagAssignments.id, id)).run(),
  getTagAssignment: (id: number) => db.select().from(tagAssignments).where(eq(tagAssignments.id, id)).get(),

  // v4 Scene Time Entries
  listSceneTimeEntries: (sceneId: number): SceneTimeEntry[] =>
    db.select().from(sceneTimeEntries).where(eq(sceneTimeEntries.sceneId, sceneId)).all(),
  getActiveTimeEntry: (sceneId: number, userId: number): SceneTimeEntry | undefined =>
    db.select().from(sceneTimeEntries)
      .where(and(eq(sceneTimeEntries.sceneId, sceneId), eq(sceneTimeEntries.userId, userId)))
      .all()
      .find(e => e.endedAt === null || e.endedAt === undefined),
  startTimer: (sceneId: number, userId: number): SceneTimeEntry =>
    db.insert(sceneTimeEntries).values({ sceneId, userId, startedAt: Date.now(), endedAt: null, durationMs: null }).returning().get(),
  stopTimer: (id: number): SceneTimeEntry | undefined => {
    const entry = db.select().from(sceneTimeEntries).where(eq(sceneTimeEntries.id, id)).get();
    if (!entry) return undefined;
    const durationMs = Date.now() - entry.startedAt;
    return db.update(sceneTimeEntries).set({ endedAt: Date.now(), durationMs }).where(eq(sceneTimeEntries.id, id)).returning().get();
  },

  // v4 Commission Pricing Presets
  listCommissionPricingPresets: (projectId: number): CommissionPricingPreset[] =>
    db.select().from(commissionPricingPresets).where(eq(commissionPricingPresets.projectId, projectId)).all(),
  createCommissionPricingPreset: (p: InsertCommissionPricingPreset): CommissionPricingPreset =>
    db.insert(commissionPricingPresets).values({ ...p, createdAt: new Date().toISOString() }).returning().get(),
  updateCommissionPricingPreset: (id: number, patch: Partial<InsertCommissionPricingPreset>): CommissionPricingPreset | undefined =>
    db.update(commissionPricingPresets).set(patch).where(eq(commissionPricingPresets.id, id)).returning().get(),
  deleteCommissionPricingPreset: (id: number) =>
    db.delete(commissionPricingPresets).where(eq(commissionPricingPresets.id, id)).run(),

  // v4 Global Search — uses raw SQLite for LIKE queries across user's accessible projects
  globalSearch: (userId: number, q: string, limit = 20) => {
    const likeQ = `%${q.toLowerCase()}%`;
    // Get user's accessible project IDs
    const memberRows = db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, userId)).all();
    const ownedProjects = db.select({ id: projects.id }).from(projects).where(eq(projects.ownerId, userId)).all();
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
  getCommissionHours: (commissionId: number): DltCommissionHours[] =>
    db.select().from(dltCommissionHours).where(eq(dltCommissionHours.commissionId, commissionId)).all(),
  addCommissionHours: (hours: InsertDltCommissionHours): DltCommissionHours =>
    db.insert(dltCommissionHours).values({ ...hours, loggedAt: new Date().toISOString() }).returning().get(),
  // === AGENT_2 ADDITIONS START ===
  createAudVoiceTake: (take: InsertAudVoiceTake) =>
    db.insert(audVoiceTakes).values(take).returning().get(),
  
  getAudVoiceTakesByProject: (projectId: number) =>
    db.select().from(audVoiceTakes).where(eq(audVoiceTakes.projectId, projectId)).all(),
  
  createAudCaption: (caption: InsertAudCaption) =>
    db.insert(audCaptions).values(caption).returning().get(),
    
  getAudCaptionsByAnimatic: (animaticProjectId: number) =>
    db.select().from(audCaptions).where(eq(audCaptions.animaticProjectId, animaticProjectId)).all(),
    
  deleteAudCaption: (id: number) =>
    db.delete(audCaptions).where(eq(audCaptions.id, id)).run(),
  // === AGENT_2 ADDITIONS END ===

  // === AGENT_1 ADDITIONS START ===
  getCliApprovals: (projectId: number) =>
    db.select().from(cli_approvals).where(eq(cli_approvals.projectId, projectId)).all(),
  
  createCliApproval: (data: Partial<typeof cli_approvals.$inferInsert>) =>
    db.insert(cli_approvals).values(data as any).returning().get(),

  getCliFeedback: (projectId: number) =>
    db.select().from(cli_feedback).where(eq(cli_feedback.projectId, projectId)).all(),
    
  createCliFeedback: (data: Partial<typeof cli_feedback.$inferInsert>) =>
    db.insert(cli_feedback).values({ ...data, createdAt: new Date().toISOString() } as any).returning().get(),
  // === AGENT_1 ADDITIONS END ===

  getA11yPrefs: (userId: number) => 
    db.select().from(a11y_user_prefs).where(eq(a11y_user_prefs.userId, userId)).get(),
  
  createA11yPrefs: (prefs: InsertA11yPrefs) => 
    db.insert(a11y_user_prefs).values(prefs).returning().get(),
  
  updateA11yPrefs: (userId: number, patch: Partial<InsertA11yPrefs>) => {
    const existing = db.select().from(a11y_user_prefs).where(eq(a11y_user_prefs.userId, userId)).get();
    if (existing) {
      return db.update(a11y_user_prefs).set(patch).where(eq(a11y_user_prefs.userId, userId)).returning().get();
    }
    return db.insert(a11y_user_prefs).values({
      userId,
      focusMode: patch.focusMode || 0,
      dyslexia: patch.dyslexia || 0,
      colorblind: patch.colorblind || 0,
      reducedMotion: patch.reducedMotion || 0,
      largeTouch: patch.largeTouch || 0,
      audioCues: patch.audioCues || 0,
    }).returning().get();
  },

  listChallengePrompts: () => db.select().from(challenge_prompts).orderBy(desc(challenge_prompts.weekNumber)).all(),
  
  listChallengeSubmissions: (userId: number) => db.select().from(challenge_submissions).where(eq(challenge_submissions.userId, userId)).all(),

  createChallengeSubmission: (submission: InsertChallengeSubmission & { userId: number }) => 
    db.insert(challenge_submissions).values({ ...submission, createdAt: new Date().toISOString() }).returning().get(),

  listChallengeFeed: (userId: number) => {
    const prompts = db.select().from(challenge_prompts).all();
    const submissions = db.select().from(challenge_submissions).orderBy(desc(challenge_submissions.createdAt)).all();
    const reactions = db.select().from(challenge_reactions).all();
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

  toggleChallengeReaction: (submissionId: number, userId: number, sticker: string): { active: boolean; reaction?: ChallengeReaction } => {
    const submission = db.select().from(challenge_submissions).where(eq(challenge_submissions.id, submissionId)).get();
    if (!submission) throw new Error("Submission not found");
    const existing = db.select().from(challenge_reactions).where(and(
      eq(challenge_reactions.submissionId, submissionId),
      eq(challenge_reactions.userId, userId),
    )).get();
    if (existing?.sticker === sticker) {
      db.delete(challenge_reactions).where(eq(challenge_reactions.id, existing.id)).run();
      return { active: false };
    }
    if (existing) {
      const updated = db.update(challenge_reactions)
        .set({ sticker, createdAt: new Date().toISOString() })
        .where(eq(challenge_reactions.id, existing.id))
        .returning()
        .get();
      return { active: true, reaction: updated };
    }
    const reaction = db.insert(challenge_reactions).values({
      submissionId,
      userId,
      sticker,
      createdAt: new Date().toISOString(),
    }).returning().get();
    return { active: true, reaction };
  },

  // === AGENT_STUDIO ADDITIONS START ===
  // Studio Render Budget
  getStudioRenderBudget: (projectId: number): StudioRenderBudget | undefined =>
    db.select().from(studio_render_budget).where(eq(studio_render_budget.projectId, projectId)).get(),
  upsertStudioRenderBudget: (projectId: number, totalMinutes: number): StudioRenderBudget => {
    const existing = db.select().from(studio_render_budget).where(eq(studio_render_budget.projectId, projectId)).get();
    const now = new Date().toISOString();
    if (existing) {
      return db.update(studio_render_budget).set({ totalMinutes, updatedAt: now }).where(eq(studio_render_budget.projectId, projectId)).returning().get()!;
    }
    return db.insert(studio_render_budget).values({ projectId, totalMinutes, updatedAt: now }).returning().get();
  },

  // Studio Render Events
  listStudioRenderEvents: (projectId: number): StudioRenderEvent[] =>
    db.select().from(studio_render_events).where(eq(studio_render_events.projectId, projectId)).orderBy(asc(studio_render_events.createdAt)).all(),
  createStudioRenderEvent: (data: InsertStudioRenderEvent): StudioRenderEvent =>
    db.insert(studio_render_events).values({ ...data, createdAt: new Date().toISOString() }).returning().get(),
  deleteStudioRenderEvent: (id: number) =>
    db.delete(studio_render_events).where(eq(studio_render_events.id, id)).run(),

  // Studio Snapshots
  listStudioSnapshots: (projectId: number): StudioSnapshot[] =>
    db.select().from(studio_snapshots).where(eq(studio_snapshots.projectId, projectId)).orderBy(asc(studio_snapshots.createdAt)).all(),
  createStudioSnapshot: (data: InsertStudioSnapshot): StudioSnapshot =>
    db.insert(studio_snapshots).values({ ...data, createdAt: new Date().toISOString() }).returning().get(),
  deleteStudioSnapshot: (id: number) =>
    db.delete(studio_snapshots).where(eq(studio_snapshots.id, id)).run(),
  getStudioSnapshot: (id: number): StudioSnapshot | undefined =>
    db.select().from(studio_snapshots).where(eq(studio_snapshots.id, id)).get(),
  restoreStudioSnapshot: (snapshotId: number, projectId: number): StudioSnapshot =>
    db.insert(studio_snapshots).values({
      projectId,
      label: `Restored from #${snapshotId}`,
      parentId: snapshotId,
      restoredFromId: snapshotId,
      createdAt: new Date().toISOString(),
    }).returning().get(),

  // Studio Credit Entries
  listStudioCreditEntries: (projectId: number): StudioCreditEntry[] =>
    db.select().from(studio_credit_entries).where(eq(studio_credit_entries.projectId, projectId)).orderBy(asc(studio_credit_entries.orderIdx)).all(),
  createStudioCreditEntry: (data: InsertStudioCreditEntry): StudioCreditEntry =>
    db.insert(studio_credit_entries).values({ ...data, createdAt: new Date().toISOString() }).returning().get(),
  updateStudioCreditEntry: (id: number, patch: Partial<InsertStudioCreditEntry>): StudioCreditEntry | undefined =>
    db.update(studio_credit_entries).set(patch).where(eq(studio_credit_entries.id, id)).returning().get(),
  deleteStudioCreditEntry: (id: number) =>
    db.delete(studio_credit_entries).where(eq(studio_credit_entries.id, id)).run(),
  replaceStudioCreditEntries: (projectId: number, entries: InsertStudioCreditEntry[]): StudioCreditEntry[] => {
    db.delete(studio_credit_entries).where(eq(studio_credit_entries.projectId, projectId)).run();
    const now = new Date().toISOString();
    const result: StudioCreditEntry[] = [];
    for (const e of entries) {
      result.push(db.insert(studio_credit_entries).values({ ...e, createdAt: now }).returning().get());
    }
    return result;
  },
  // === AGENT_STUDIO ADDITIONS END ===

  // === LORE ADDITIONS START ===
  listLorFacts: (projectId: number): LorContinuityFact[] =>
    db.select().from(lor_continuity_facts).where(eq(lor_continuity_facts.projectId, projectId)).all(),
  createLorFact: (f: InsertLorContinuityFact): LorContinuityFact =>
    db.insert(lor_continuity_facts).values({ ...f, createdAt: new Date().toISOString() }).returning().get(),
  updateLorFact: (id: number, patch: Partial<InsertLorContinuityFact>): LorContinuityFact | undefined =>
    db.update(lor_continuity_facts).set(patch).where(eq(lor_continuity_facts.id, id)).returning().get(),
  deleteLorFact: (id: number) => db.delete(lor_continuity_facts).where(eq(lor_continuity_facts.id, id)).run(),
  getLorFact: (id: number): LorContinuityFact | undefined =>
    db.select().from(lor_continuity_facts).where(eq(lor_continuity_facts.id, id)).get(),

  listLorPalettes: (projectId: number): LorPalette[] =>
    db.select().from(lor_palettes).where(eq(lor_palettes.projectId, projectId)).all(),
  createLorPalette: (p: InsertLorPalette): LorPalette =>
    db.insert(lor_palettes).values({ ...p, createdAt: new Date().toISOString() }).returning().get(),
  deleteLorPalette: (id: number) => db.delete(lor_palettes).where(eq(lor_palettes.id, id)).run(),
  getLorPalette: (id: number): LorPalette | undefined =>
    db.select().from(lor_palettes).where(eq(lor_palettes.id, id)).get(),

  listLorAssetVersions: (assetId: number): LorAssetVersion[] =>
    db.select().from(lor_asset_versions).where(eq(lor_asset_versions.assetId, assetId)).orderBy(desc(lor_asset_versions.versionNum)).all(),
  createLorAssetVersion: (v: InsertLorAssetVersion): LorAssetVersion =>
    db.insert(lor_asset_versions).values({ ...v, uploadedAt: new Date().toISOString() }).returning().get(),
  updateLorAssetVersionsForAsset: (assetId: number, patch: Partial<LorAssetVersion>) =>
    db.update(lor_asset_versions).set(patch).where(eq(lor_asset_versions.assetId, assetId)).run(),
  updateLorAssetVersion: (id: number, patch: Partial<LorAssetVersion>): LorAssetVersion | undefined =>
    db.update(lor_asset_versions).set(patch).where(eq(lor_asset_versions.id, id)).returning().get(),
  getLorAssetVersion: (id: number): LorAssetVersion | undefined =>
    db.select().from(lor_asset_versions).where(eq(lor_asset_versions.id, id)).get(),

  listLorCasting: (projectId: number): LorCastingMatrix[] =>
    db.select().from(lor_casting_matrix).where(eq(lor_casting_matrix.projectId, projectId)).all(),
  upsertLorCasting: (projectId: number, sceneId: number, entityId: number, present: boolean) => {
    const existing = db.select().from(lor_casting_matrix).where(
      and(
        eq(lor_casting_matrix.projectId, projectId),
        eq(lor_casting_matrix.sceneId, sceneId),
        eq(lor_casting_matrix.entityId, entityId)
      )
    ).get();
    if (existing) {
      return db.update(lor_casting_matrix).set({ present }).where(eq(lor_casting_matrix.id, existing.id)).run();
    } else {
      return db.insert(lor_casting_matrix).values({ projectId, sceneId, entityId, present }).run();
    }
  },
  // === LORE ADDITIONS END ===
});
