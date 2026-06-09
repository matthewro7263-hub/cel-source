import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { eq, and, or, inArray, asc, desc, like, sql, isNull, lt } from "drizzle-orm";
import { randomBytes, scrypt, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { AsyncLocalStorage } from "node:async_hooks";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: { N?: number; r?: number; p?: number; maxmem?: number },
) => Promise<Buffer>;

import * as mainSchema from "@shared/schema";
import * as a11ySchema from "@shared/a11y_schema";
import * as challengeSchema from "@shared/challenge_schema";
import * as challengeLeaderboardSchema from "@shared/challenge_leaderboard_schema";
import * as lorSchema from "@shared/lor_schema";
import * as studioSchema from "@shared/studio_schema";

const schema = {
  ...mainSchema,
  ...a11ySchema,
  ...challengeSchema,
  ...challengeLeaderboardSchema,
  ...lorSchema,
  ...studioSchema,
};

// Re-export individual tables for convenience in methods
const {
  users, projects, projectMembers, scripts, storyboards, storyboardPanels,
  animatics, scenes, comments, assets, commissions, renders,
  animaticProjects, animaticTracks, animaticClips,
  projectAiKeys, aiChatSessions, aiChatMessages, achievements, panelPins,
  commissionLineItems, inboxItems, tags, tagAssignments, userActivityLog,
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
import type {
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
import type { A11yPrefs, InsertA11yPrefs } from "@shared/a11y_schema";
import type { ChallengePrompt, ChallengeReaction, ChallengeSubmission, InsertChallengeSubmission } from "@shared/challenge_schema";
import type {
  LorContinuityFact, InsertLorContinuityFact,
  LorPalette, InsertLorPalette,
  LorAssetVersion, InsertLorAssetVersion,
  LorCastingMatrix, InsertLorCastingMatrix,
} from "@shared/lor_schema";
import type {
  StudioRenderEvent, InsertStudioRenderEvent,
  StudioRenderBudget,
  StudioSnapshot, InsertStudioSnapshot,
  StudioCreditEntry, InsertStudioCreditEntry,
} from "@shared/studio_schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });

const projectIdCache = new AsyncLocalStorage<Map<number, number[]>>();

export function runWithProjectIdCache<T>(fn: () => T): T {
  return projectIdCache.run(new Map(), fn);
}

// ===== PASSWORD UTILS =====
const SCRYPT_PARAMS = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64, SCRYPT_PARAMS)).toString("hex");
  return `v2:${salt}:${hash}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length === 2) {
    // Legacy format: salt:hash (uses default scrypt params)
    const [salt, hash] = parts;
    const check = (await scryptAsync(password, salt, 64)).toString("hex");
    try {
      return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
    } catch {
      return false;
    }
  } else if (parts.length === 3 && parts[0] === "v2") {
    // New format: v2:salt:hash
    const [, salt, hash] = parts;
    const check = (await scryptAsync(password, salt, 64, SCRYPT_PARAMS)).toString("hex");
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

// ===== SESSIONS (cryptographic, stateless & persistent) =====
const SESSION_SECRET = process.env.SESSION_SECRET || "fallback-secret-for-dev-only-change-in-prod-1234567890abcdef";

export function createSession(userId: number, tokenVersion: number): string {
  // Session expires in 30 days
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const payload = `${userId}:${expiresAt}:${tokenVersion}`;
  const hmac = createHmac("sha256", SESSION_SECRET);
  hmac.update(payload);
  const signature = hmac.digest("hex");
  return `${payload}:${signature}`;
}

export function getSessionPayload(sid: string | undefined): { userId: number; tokenVersion: number } | undefined {
  if (!sid) return undefined;
  const parts = sid.split(":");
  if (parts.length !== 4) return undefined;
  const [userIdStr, expiresAtStr, tokenVersionStr, signature] = parts;
  const userId = parseInt(userIdStr, 10);
  const expiresAt = parseInt(expiresAtStr, 10);
  const tokenVersion = parseInt(tokenVersionStr, 10);

  if (isNaN(userId) || isNaN(expiresAt) || isNaN(tokenVersion)) return undefined;
  if (Date.now() > expiresAt) return undefined;

  const payload = `${userIdStr}:${expiresAtStr}:${tokenVersionStr}`;
  const hmac = createHmac("sha256", SESSION_SECRET);
  hmac.update(payload);
  const expectedSignature = hmac.digest("hex");

  try {
    if (timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))) {
      return { userId, tokenVersion };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function getSessionUser(sid: string | undefined): number | undefined {
  return getSessionPayload(sid)?.userId;
}

export function destroySession(sid: string) {
  // Stateless token destruction is handled by client-side token clearing
}

const coreStorage = {
  // ===== USERS =====
  async getUser(id: number) { return await db.select().from(users).where(eq(users.id, id)).then(r => r[0]); },
  async getUsersByIds(ids: number[]) {
    if (ids.length === 0) return [];
    const unique = Array.from(new Set(ids));
    return await db.select().from(users).where(inArray(users.id, unique));
  },
  async getUserByEmail(email: string) { return await db.select().from(users).where(eq(users.email, email)).then(r => r[0]); },
  async createUser(u: InsertUser) { return await db.insert(users).values(u).returning().then(r => r[0] as any); },
  async updateUser(id: number, patch: Partial<InsertUser>) { return await db.update(users).set(patch).where(eq(users.id, id)).returning().then(r => r[0] as any); },

  // ===== PROJECTS =====
  async listProjectsForUser(userId: number) {
      const memberRows = await db
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
  async getProject(id: number) { return await db.select().from(projects).where(eq(projects.id, id)).then(r => r[0]); },
  async getProjectByToken(token: string) { return await db.select().from(projects).where(eq(projects.shareToken, token)).then(r => r[0]); },
  async createProject(p: InsertProject) {
      const row = await db.insert(projects).values({ ...p, createdAt: new Date() }).returning().then(r => r[0] as any);
      return row;
    },
  async updateProject(id: number, patch: Partial<InsertProject>) { return await db.update(projects).set(patch).where(eq(projects.id, id)).returning().then(r => r[0] as any); },
  async deleteProject(id: number) {
      await db.delete(comments).where(eq(comments.projectId, id));
      await db.delete(scenes).where(eq(scenes.projectId, id));
      const sbs = await db.select({ id: storyboards.id }).from(storyboards).where(eq(storyboards.projectId, id));
      if (sbs.length > 0) {
        await db.delete(storyboardPanels).where(inArray(storyboardPanels.storyboardId, sbs.map((sb) => sb.id)));
      }
      await db.delete(storyboards).where(eq(storyboards.projectId, id));
      await db.delete(animatics).where(eq(animatics.projectId, id));
      await db.delete(scripts).where(eq(scripts.projectId, id));
      await db.delete(projectMembers).where(eq(projectMembers.projectId, id));
      await db.delete(projects).where(eq(projects.id, id));
    },

  // ===== MEMBERS =====
  async listMembers(projectId: number) {
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
  async addMember(m: InsertProjectMember) { return await db.insert(projectMembers).values(m).returning().then(r => r[0] as any); },
  async removeMember(projectId: number, userId: number) { return await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))); },
  async isMember(projectId: number, userId: number) {
      const row = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).then(r => r[0]);
      return !!row;
    },

  // ===== SCRIPTS =====
  async listScripts(projectId: number) { return await db.select().from(scripts).where(eq(scripts.projectId, projectId)); },
  async listScriptsLite(projectId: number) {
    return await db
      .select({
        id: scripts.id,
        projectId: scripts.projectId,
        title: scripts.title,
        sourceType: scripts.sourceType,
        sourceFormat: scripts.sourceFormat,
        originalKey: scripts.originalKey,
        updatedAt: scripts.updatedAt,
        deletedAt: scripts.deletedAt,
      })
      .from(scripts)
      .where(eq(scripts.projectId, projectId));
  },
  async getScript(id: number) { return await db.select().from(scripts).where(eq(scripts.id, id)).then(r => r[0]); },
  async createScript(s: InsertScript) { return await db.insert(scripts).values({ ...s, updatedAt: new Date() }).returning().then(r => r[0] as any); },
  async updateScript(id: number, patch: Partial<InsertScript>) { return await db.update(scripts).set({ ...patch, updatedAt: new Date() }).where(eq(scripts.id, id)).returning().then(r => r[0] as any); },
  async deleteScript(id: number) { return await db.delete(scripts).where(eq(scripts.id, id)); },

  // ===== STORYBOARDS =====
  async listStoryboards(projectId: number) { return await db.select().from(storyboards).where(eq(storyboards.projectId, projectId)); },
  async listStoryboardsForProjectIds(projectIds: number[]) {
    if (projectIds.length === 0) return [];
    return await db.select().from(storyboards).where(inArray(storyboards.projectId, projectIds));
  },
  async getStoryboard(id: number) { return await db.select().from(storyboards).where(eq(storyboards.id, id)).then(r => r[0]); },
  async createStoryboard(s: InsertStoryboard) { return await db.insert(storyboards).values({ ...s, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async deleteStoryboard(id: number) {
      await db.delete(storyboardPanels).where(eq(storyboardPanels.storyboardId, id));
      await db.delete(storyboards).where(eq(storyboards.id, id));
    },

  // ===== PANELS =====
  async listPanels(storyboardId: number) { return await db.select().from(storyboardPanels).where(eq(storyboardPanels.storyboardId, storyboardId)).orderBy(asc(storyboardPanels.orderIdx)); },
  async listPanelsLite(storyboardId: number) {
    return await db
      .select({
        id: storyboardPanels.id,
        storyboardId: storyboardPanels.storyboardId,
        orderIdx: storyboardPanels.orderIdx,
        r2Key: storyboardPanels.r2Key,
        sceneId: storyboardPanels.sceneId,
        caption: storyboardPanels.caption,
        dialogue: storyboardPanels.dialogue,
        notes: storyboardPanels.notes,
        changeRequest: storyboardPanels.changeRequest,
        status: storyboardPanels.status,
        frameCount: storyboardPanels.frameCount,
        deletedAt: storyboardPanels.deletedAt,
      })
      .from(storyboardPanels)
      .where(and(eq(storyboardPanels.storyboardId, storyboardId), isNull(storyboardPanels.deletedAt)))
      .orderBy(asc(storyboardPanels.orderIdx));
  },
  async listPanelsLiteBatch(storyboardIds: number[]) {
    if (storyboardIds.length === 0) return [];
    return await db
      .select({
        id: storyboardPanels.id,
        storyboardId: storyboardPanels.storyboardId,
        orderIdx: storyboardPanels.orderIdx,
        r2Key: storyboardPanels.r2Key,
        sceneId: storyboardPanels.sceneId,
        caption: storyboardPanels.caption,
        dialogue: storyboardPanels.dialogue,
        notes: storyboardPanels.notes,
        changeRequest: storyboardPanels.changeRequest,
        status: storyboardPanels.status,
        frameCount: storyboardPanels.frameCount,
        deletedAt: storyboardPanels.deletedAt,
      })
      .from(storyboardPanels)
      .where(and(inArray(storyboardPanels.storyboardId, storyboardIds), isNull(storyboardPanels.deletedAt)))
      .orderBy(asc(storyboardPanels.storyboardId), asc(storyboardPanels.orderIdx));
  },
  async listPanelsForStoryboardIds(ids: number[]) {
    if (ids.length === 0) return [];
    return await db
      .select()
      .from(storyboardPanels)
      .where(inArray(storyboardPanels.storyboardId, ids))
      .orderBy(asc(storyboardPanels.storyboardId), asc(storyboardPanels.orderIdx));
  },
  async createPanel(p: InsertPanel) { return await db.insert(storyboardPanels).values(p).returning().then(r => r[0] as any); },
  async createPanelsBulk(panels: InsertPanel[]) {
    if (panels.length === 0) return [];
    return await db.insert(storyboardPanels).values(panels).returning();
  },
  async updatePanel(id: number, patch: Partial<InsertPanel>) { return await db.update(storyboardPanels).set(patch).where(eq(storyboardPanels.id, id)).returning().then(r => r[0] as any); },
  async reorderPanels(storyboardId: number, orderedIds: number[]) {
    if (orderedIds.length === 0) return;
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(storyboardPanels)
          .set({ orderIdx: i })
          .where(and(eq(storyboardPanels.id, orderedIds[i]), eq(storyboardPanels.storyboardId, storyboardId)));
      }
    });
  },
  async deletePanel(id: number) { return await db.delete(storyboardPanels).where(eq(storyboardPanels.id, id)); },
  async getPanel(id: number) { return await db.select().from(storyboardPanels).where(eq(storyboardPanels.id, id)).then(r => r[0]); },
  async isR2KeyInProject(projectId: number, r2Key: string): Promise<boolean> {
    if (!r2Key) return false;
    const projectStoryboards = await db
      .select({ id: storyboards.id })
      .from(storyboards)
      .where(eq(storyboards.projectId, projectId));
    const sbIds = projectStoryboards.map((sb) => sb.id);
    if (sbIds.length > 0) {
      const panelHit = await db
        .select({ id: storyboardPanels.id })
        .from(storyboardPanels)
        .where(and(inArray(storyboardPanels.storyboardId, sbIds), eq(storyboardPanels.r2Key, r2Key)))
        .limit(1);
      if (panelHit.length > 0) return true;
    }
    const assetHit = await db
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.projectId, projectId), eq(assets.r2Key, r2Key)))
      .limit(1);
    return assetHit.length > 0;
  },

  // ===== ANIMATICS =====
  async listAnimatics(projectId: number) { return await db.select().from(animatics).where(eq(animatics.projectId, projectId)); },
  async listAnimaticsLite(projectId: number) {
    return await db
      .select({
        id: animatics.id,
        projectId: animatics.projectId,
        title: animatics.title,
        notes: animatics.notes,
        createdAt: animatics.createdAt,
      })
      .from(animatics)
      .where(eq(animatics.projectId, projectId));
  },
  async createAnimatic(a: InsertAnimatic) { return await db.insert(animatics).values({ ...a, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async deleteAnimatic(id: number) { return await db.delete(animatics).where(eq(animatics.id, id)); },

  // ===== SCENES =====
  async listScenes(projectId: number) { return await db.select().from(scenes).where(eq(scenes.projectId, projectId)); },
  async listScenesForProjectIds(projectIds: number[]) {
    if (projectIds.length === 0) return [];
    return await db.select().from(scenes).where(inArray(scenes.projectId, projectIds));
  },
  async getScene(id: number) { return await db.select().from(scenes).where(eq(scenes.id, id)).then(r => r[0]); },
  async createScene(s: InsertScene) { return await db.insert(scenes).values(s).returning().then(r => r[0] as any); },
  async updateScene(id: number, patch: Partial<InsertScene>) { return await db.update(scenes).set(patch).where(eq(scenes.id, id)).returning().then(r => r[0] as any); },
  async deleteScene(id: number) { return await db.delete(scenes).where(eq(scenes.id, id)); },

  // ===== COMMENTS =====
  async listComments(projectId: number, opts?: { limit?: number; cursor?: number }) {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const conditions = [eq(comments.projectId, projectId)];
    if (opts?.cursor) conditions.push(lt(comments.id, opts.cursor));
    const rows = await db
      .select()
      .from(comments)
      .where(and(...conditions))
      .orderBy(desc(comments.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;
    return { items, nextCursor };
  },
  async listCommentsForProjectIds(projectIds: number[]) {
    if (projectIds.length === 0) return [];
    return await db
      .select()
      .from(comments)
      .where(inArray(comments.projectId, projectIds))
      .orderBy(desc(comments.createdAt));
  },
  async createComment(c: InsertComment) { return await db.insert(comments).values({ ...c, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async deleteComment(id: number) { return await db.delete(comments).where(eq(comments.id, id)); },

  // ===== ASSETS =====
  async listAssets(projectId: number, category?: string, opts?: { limit?: number; cursor?: number }) {
      const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
      const cols = {
        id: assets.id,
        projectId: assets.projectId,
        category: assets.category,
        filename: assets.filename,
        mimeType: assets.mimeType,
        r2Key: assets.r2Key,
        thumbnailData: assets.thumbnailData,
        notes: assets.notes,
        tags: assets.tags,
        uploaderId: assets.uploaderId,
        createdAt: assets.createdAt,
        deletedAt: assets.deletedAt,
      };
      const baseConditions = category
        ? and(eq(assets.projectId, projectId), eq(assets.category, category))
        : eq(assets.projectId, projectId);
      const conditions = opts?.cursor
        ? and(baseConditions, lt(assets.id, opts.cursor))
        : baseConditions;
      const rows = await db
        .select(cols)
        .from(assets)
        .where(conditions)
        .orderBy(desc(assets.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;
      return { items, nextCursor };
    },
  async listAssetsForProjectIds(projectIds: number[]) {
    if (projectIds.length === 0) return [];
    const cols = {
      id: assets.id,
      projectId: assets.projectId,
      category: assets.category,
      filename: assets.filename,
      mimeType: assets.mimeType,
      r2Key: assets.r2Key,
      notes: assets.notes,
      tags: assets.tags,
      uploaderId: assets.uploaderId,
      createdAt: assets.createdAt,
      deletedAt: assets.deletedAt,
    };
    return await db
      .select(cols)
      .from(assets)
      .where(inArray(assets.projectId, projectIds))
      .orderBy(desc(assets.createdAt));
  },
  async getAsset(id: number) { return await db.select().from(assets).where(eq(assets.id, id)).then(r => r[0]); },
  async createAsset(a: InsertAsset) { return await db.insert(assets).values({ ...a, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async updateAsset(id: number, patch: Partial<Pick<InsertAsset, 'notes' | 'tags' | 'category'>>) { return await db.update(assets).set(patch).where(eq(assets.id, id)).returning().then(r => r[0] as any); },
  async deleteAsset(id: number) { return await db.delete(assets).where(eq(assets.id, id)); },

  // ===== COMMISSIONS =====
  async listCommissions(ownerUserId: number) { return await db.select().from(commissions).where(eq(commissions.ownerUserId, ownerUserId)).orderBy(asc(commissions.status), desc(commissions.createdAt)); },
  async getCommission(id: number) { return await db.select().from(commissions).where(eq(commissions.id, id)).then(r => r[0]); },
  async createCommission(c: InsertCommission) { return await db.insert(commissions).values({ ...c, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async updateCommission(id: number, patch: Partial<Pick<Commission, 'status' | 'notes' | 'linkedProjectId'>>) { return await db.update(commissions).set(patch).where(eq(commissions.id, id)).returning().then(r => r[0] as any); },

  // ===== RENDERS =====
  async listRenders(sceneId: number) { return await db.select().from(renders).where(eq(renders.sceneId, sceneId)).orderBy(desc(renders.createdAt)); },
  async getRender(id: number) { return await db.select().from(renders).where(eq(renders.id, id)).then(r => r[0]); },
  async createRender(r: InsertRender) { return await db.insert(renders).values({ ...r, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async updateRender(id: number, patch: Partial<InsertRender>) { return await db.update(renders).set(patch).where(eq(renders.id, id)).returning().then(r => r[0] as any); },
  async deleteRender(id: number) { return await db.delete(renders).where(eq(renders.id, id)); },

  // ===== ANIMATIC PROJECTS (v2) =====
  async getAnimaticProjectsByProject(projectId: number) { return await db.select().from(animaticProjects).where(eq(animaticProjects.projectId, projectId)).orderBy(desc(animaticProjects.createdAt)); },

  async getAnimaticProject(id: number) {
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

  async createAnimaticProject(data: InsertAnimaticProject) {
      const now = new Date();
      const ap = await db.insert(animaticProjects).values({ ...data, createdAt: now, updatedAt: now }).returning().then(r => r[0] as any);
      // Create 4 default tracks
      const defaultTracks: { kind: string; name: string; orderIdx: number }[] = [
        { kind: "panel", name: "Panels", orderIdx: 0 },
        { kind: "voice", name: "Voice", orderIdx: 1 },
        { kind: "sfx", name: "SFX", orderIdx: 2 },
        { kind: "music", name: "Music", orderIdx: 3 },
      ];
      await db.insert(animaticTracks).values(
        defaultTracks.map((t) => ({
          animaticProjectId: ap.id,
          kind: t.kind,
          name: t.name,
          orderIdx: t.orderIdx,
          muted: false,
          volume: 1000,
        })),
      );
      return ap;
    },

  async updateAnimaticProject(id: number, patch: Partial<InsertAnimaticProject>) { return await db.update(animaticProjects).set({ ...patch, updatedAt: new Date() }).where(eq(animaticProjects.id, id)).returning().then(r => r[0] as any); },

  async deleteAnimaticProject(id: number) {
      const tracks = await db.select().from(animaticTracks).where(eq(animaticTracks.animaticProjectId, id));
      for (const t of tracks) {
        await db.delete(animaticClips).where(eq(animaticClips.trackId, t.id));
      }
      await db.delete(animaticTracks).where(eq(animaticTracks.animaticProjectId, id));
      await db.delete(animaticProjects).where(eq(animaticProjects.id, id));
    },

  // ===== ANIMATIC TRACKS =====
  async createTrack(data: InsertAnimaticTrack) { return await db.insert(animaticTracks).values(data).returning().then(r => r[0] as any); },

  async updateTrack(id: number, patch: Partial<InsertAnimaticTrack>) { return await db.update(animaticTracks).set(patch).where(eq(animaticTracks.id, id)).returning().then(r => r[0] as any); },

  async deleteTrack(id: number) {
      await db.delete(animaticClips).where(eq(animaticClips.trackId, id));
      await db.delete(animaticTracks).where(eq(animaticTracks.id, id));
    },

  async getTrack(id: number) { return await db.select().from(animaticTracks).where(eq(animaticTracks.id, id)).then(r => r[0]); },

  // ===== ANIMATIC CLIPS =====
  async createClip(data: InsertAnimaticClip) { return await db.insert(animaticClips).values(data).returning().then(r => r[0] as any); },

  async updateClip(id: number, patch: Partial<InsertAnimaticClip>) { return await db.update(animaticClips).set(patch).where(eq(animaticClips.id, id)).returning().then(r => r[0] as any); },

  async deleteClip(id: number) { return await db.delete(animaticClips).where(eq(animaticClips.id, id)); },

  async getClip(id: number) { return await db.select().from(animaticClips).where(eq(animaticClips.id, id)).then(r => r[0]); },

  // raw access for seed
  _db: db,
};

// ============================================================
// v4 — table creation and extensions
// ============================================================
// Create v4 tables (idempotent)


// Migrate existing commissions table to add v4 columns (safe, idempotent)
try {  } catch {}
try {  } catch {}
try {  } catch {}
try {  } catch {}
try {  } catch {}

// ===== v5 bak modifications =====
try {  } catch {}
try {  } catch {}
try {  } catch {}





// ================================





// ============================================================
// v4 storage methods (append to export object below)
// ============================================================

// Extend the storage object with v4 methods
const extraStorage = {
  // Helper to resolve all project IDs for a user (owned + member of)
  async getProjectIdsForUser(userId: number): Promise<number[]> {
    const cache = projectIdCache.getStore();
    if (cache?.has(userId)) return cache.get(userId)!;

    const memberRows = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));
    const ids = memberRows.map((r) => r.projectId);
    const owned = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.ownerId, userId));
    const allIds = new Set([...ids, ...owned.map(p => p.id)]);
    const result = Array.from(allIds);
    cache?.set(userId, result);
    return result;
  },
  async countAllScenesForUser(userId: number): Promise<number> {
    const ids = await this.getProjectIdsForUser(userId);
    if (ids.length === 0) return 0;
    const res = await db.select({ count: sql<number>`count(*)::int` }).from(scenes).where(and(inArray(scenes.projectId, ids), isNull(scenes.deletedAt)));
    return res[0]?.count ?? 0;
  },
  async countAllPanelsForUser(userId: number): Promise<number> {
    const ids = await this.getProjectIdsForUser(userId);
    if (ids.length === 0) return 0;
    const sbs = await db.select({ id: storyboards.id }).from(storyboards).where(inArray(storyboards.projectId, ids));
    const sbIds = sbs.map(r => r.id);
    if (sbIds.length === 0) return 0;
    const res = await db.select({ count: sql<number>`count(*)::int` }).from(storyboardPanels).where(and(inArray(storyboardPanels.storyboardId, sbIds), isNull(storyboardPanels.deletedAt)));
    return res[0]?.count ?? 0;
  },
  async countAllCommentsForUser(userId: number): Promise<number> {
    const ids = await this.getProjectIdsForUser(userId);
    if (ids.length === 0) return 0;
    const res = await db.select({ count: sql<number>`count(*)::int` }).from(comments).where(inArray(comments.projectId, ids));
    return res[0]?.count ?? 0;
  },

  // v4 AI Keys
  async getProjectAiKey(projectId: number) { return await db.select().from(projectAiKeys).where(eq(projectAiKeys.projectId, projectId)).then(r => r[0]); },
  async setProjectAiKey(projectId: number, encryptedKey: string, model: string | null = null) {
        const existing = await db.select().from(projectAiKeys).where(eq(projectAiKeys.projectId, projectId)).then(r => r[0]);
        if (existing) {
          return await db.update(projectAiKeys).set({ encryptedKey, model }).where(eq(projectAiKeys.projectId, projectId)).returning().then(r => r[0] as any)!;
        }
        return await db.insert(projectAiKeys).values({ projectId, encryptedKey, model, createdAt: new Date() }).returning().then(r => r[0] as any);
      },
  async deleteProjectAiKey(projectId: number) { return await db.delete(projectAiKeys).where(eq(projectAiKeys.projectId, projectId)); },

  // v4 AI Agent Chat
  async listAiChatSessions(projectId: number) { return await db.select().from(aiChatSessions).where(eq(aiChatSessions.projectId, projectId)).orderBy(desc(aiChatSessions.createdAt)); },
  async getAiChatSession(id: number) { return await db.select().from(aiChatSessions).where(eq(aiChatSessions.id, id)).then(r => r[0]); },
  async createAiChatSession(data: InsertAiChatSession) { return await db.insert(aiChatSessions).values({ ...data, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async deleteAiChatSession(id: number) {
      await db.delete(aiChatMessages).where(eq(aiChatMessages.sessionId, id));
      await db.delete(aiChatSessions).where(eq(aiChatSessions.id, id));
    },
  async listAiChatMessages(sessionId: number) { return await db.select().from(aiChatMessages).where(eq(aiChatMessages.sessionId, sessionId)).orderBy(asc(aiChatMessages.id)); },
  async createAiChatMessage(data: InsertAiChatMessage) { return await db.insert(aiChatMessages).values({ ...data, createdAt: new Date() }).returning().then(r => r[0] as any); },

  // v4 Achievements
  async listAchievements(userId: number) { return await db.select().from(achievements).where(eq(achievements.userId, userId)); },
  async hasAchievement(userId: number, code: string) { return !!await db.select().from(achievements).where(and(eq(achievements.userId, userId), eq(achievements.code, code))).then(r => r[0]); },
  async unlockAchievement(userId: number, code: string) { return await db.insert(achievements).values({ userId, code, unlockedAt: new Date() }).returning().then(r => r[0] as any); },
  async logUserActivity(userId: number, date: string) {
    const existing = await db.select().from(userActivityLog).where(and(eq(userActivityLog.userId, userId), eq(userActivityLog.date, date))).then(r => r[0]);
    if (!existing) {
      await db.insert(userActivityLog).values({ userId, date });
    }
  },
  async getUserActivityDates(userId: number): Promise<string[]> {
    const rows = await db.select({ date: userActivityLog.date }).from(userActivityLog).where(eq(userActivityLog.userId, userId)).orderBy(asc(userActivityLog.date));
    return rows.map(r => r.date);
  },

  // v4 Panel Pins
  async listPanelPins(panelId: number) { return await db.select().from(panelPins).where(eq(panelPins.panelId, panelId)); },
  async listPanelPinsForStoryboard(storyboardId: number) {
    const panelRows = await db
      .select({ id: storyboardPanels.id })
      .from(storyboardPanels)
      .where(eq(storyboardPanels.storyboardId, storyboardId));
    const panelIds = panelRows.map((p) => p.id);
    if (panelIds.length === 0) return [];
    return await db.select().from(panelPins).where(inArray(panelPins.panelId, panelIds));
  },
  async createPanelPin(p: InsertPanelPin) { return await db.insert(panelPins).values({ ...p, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async deletePanelPin(id: number) { return await db.delete(panelPins).where(eq(panelPins.id, id)); },
  async getPanelPin(id: number) { return await db.select().from(panelPins).where(eq(panelPins.id, id)).then(r => r[0]); },

  // v4 Commission Line Items
  async listCommissionLineItems(commissionId: number) { return await db.select().from(commissionLineItems).where(eq(commissionLineItems.commissionId, commissionId)); },
  async createCommissionLineItem(item: InsertCommissionLineItem) { return await db.insert(commissionLineItems).values({ ...item, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async updateCommissionLineItem(id: number, patch: Partial<InsertCommissionLineItem>) { return await db.update(commissionLineItems).set(patch).where(eq(commissionLineItems.id, id)).returning().then(r => r[0] as any); },
  async getCommissionLineItem(id: number) { return await db.select().from(commissionLineItems).where(eq(commissionLineItems.id, id)).then(r => r[0]); },
  async deleteCommissionLineItem(id: number) { return await db.delete(commissionLineItems).where(eq(commissionLineItems.id, id)); },
  async updateCommissionQuote(id: number, quoteCents: number | null, invoicedAt?: string | null) {
      const patch: any = {};
      if (quoteCents !== undefined) patch.quoteCents = quoteCents;
      if (invoicedAt !== undefined) patch.invoicedAt = invoicedAt;
      return await db.update(commissions).set(patch).where(eq(commissions.id, id)).returning().then(r => r[0] as any);
    },

  // v4 Inbox Items
  async listInboxItems(userId: number) { return await db.select().from(inboxItems).where(eq(inboxItems.userId, userId)).orderBy(desc(inboxItems.createdAt)); },
  async createInboxItem(item: InsertInboxItem) { return await db.insert(inboxItems).values({ ...item, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async updateInboxItem(id: number, patch: Partial<InsertInboxItem>) { return await db.update(inboxItems).set(patch).where(eq(inboxItems.id, id)).returning().then(r => r[0] as any); },
  async deleteInboxItem(id: number) { return await db.delete(inboxItems).where(eq(inboxItems.id, id)); },
  async getInboxItem(id: number) { return await db.select().from(inboxItems).where(eq(inboxItems.id, id)).then(r => r[0]); },

  // v4 Tags
  async listTags(userId: number) { return await db.select().from(tags).where(eq(tags.userId, userId)); },
  async createTag(t: InsertTag) { return await db.insert(tags).values(t).returning().then(r => r[0] as any); },
  async updateTag(id: number, patch: Partial<InsertTag>) { return await db.update(tags).set(patch).where(eq(tags.id, id)).returning().then(r => r[0] as any); },
  async deleteTag(id: number) {
      await db.delete(tagAssignments).where(eq(tagAssignments.tagId, id));
      await db.delete(tags).where(eq(tags.id, id));
    },
  async getTag(id: number) { return await db.select().from(tags).where(eq(tags.id, id)).then(r => r[0]); },

  // v4 Tag Assignments
  async listTagAssignments(entityKind: string, entityId: number) { return await db.select().from(tagAssignments).where(and(eq(tagAssignments.entityKind, entityKind), eq(tagAssignments.entityId, entityId))); },
  async createTagAssignment(a: InsertTagAssignment) { return await db.insert(tagAssignments).values(a).returning().then(r => r[0] as any); },
  async deleteTagAssignment(id: number) { return await db.delete(tagAssignments).where(eq(tagAssignments.id, id)); },
  async getTagAssignment(id: number) { return await db.select().from(tagAssignments).where(eq(tagAssignments.id, id)).then(r => r[0]); },

  // v4 Scene Time Entries
  async listSceneTimeEntries(sceneId: number) { return await db.select().from(sceneTimeEntries).where(eq(sceneTimeEntries.sceneId, sceneId)); },
  async listSceneTimeEntriesForUser(sceneId: number, userId: number) {
    return await db
      .select()
      .from(sceneTimeEntries)
      .where(and(eq(sceneTimeEntries.sceneId, sceneId), eq(sceneTimeEntries.userId, userId)));
  },
  async getActiveSceneTimersForProject(projectId: number, userId: number) {
    const projectScenes = await db
      .select({ id: scenes.id })
      .from(scenes)
      .where(eq(scenes.projectId, projectId));
    const sceneIds = projectScenes.map((s) => s.id);
    if (sceneIds.length === 0) return {};
    const entries = await db
      .select()
      .from(sceneTimeEntries)
      .where(and(inArray(sceneTimeEntries.sceneId, sceneIds), eq(sceneTimeEntries.userId, userId)));
    const byScene: Record<number, { entries: typeof entries; totalMs: number; active: (typeof entries)[number] | null }> = {};
    for (const sceneId of sceneIds) {
      const sceneEntries = entries.filter((e) => e.sceneId === sceneId);
      const totalMs = sceneEntries
        .filter((e) => e.durationMs != null)
        .reduce((sum, e) => sum + (e.durationMs ?? 0), 0);
      const active = sceneEntries.find((e) => e.endedAt == null) ?? null;
      byScene[sceneId] = { entries: sceneEntries, totalMs, active };
    }
    return byScene;
  },
  async getActiveTimeEntry(sceneId: number, userId: number) { const entries = await db.select().from(sceneTimeEntries).where(and(eq(sceneTimeEntries.sceneId, sceneId), eq(sceneTimeEntries.userId, userId))); return entries.find(e => e.endedAt === null || e.endedAt === undefined); },
  async startTimer(sceneId: number, userId: number) { return await db.insert(sceneTimeEntries).values({ sceneId, userId, startedAt: Date.now(), endedAt: null, durationMs: null }).returning().then(r => r[0] as any); },
  async stopTimer(id: number) {
      const entry = await db.select().from(sceneTimeEntries).where(eq(sceneTimeEntries.id, id)).then(r => r[0]);
      if (!entry) return undefined;
      const durationMs = Date.now() - entry.startedAt;
      return await db.update(sceneTimeEntries).set({ endedAt: Date.now(), durationMs }).where(eq(sceneTimeEntries.id, id)).returning().then(r => r[0] as any);
    },

  // v4 Commission Pricing Presets
  async listCommissionPricingPresets(projectId: number) { return await db.select().from(commissionPricingPresets).where(eq(commissionPricingPresets.projectId, projectId)); },
  async createCommissionPricingPreset(p: InsertCommissionPricingPreset) { return await db.insert(commissionPricingPresets).values({ ...p, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async updateCommissionPricingPreset(id: number, patch: Partial<InsertCommissionPricingPreset>) { return await db.update(commissionPricingPresets).set(patch).where(eq(commissionPricingPresets.id, id)).returning().then(r => r[0] as any); },
  async getCommissionPricingPreset(id: number) { return await db.select().from(commissionPricingPresets).where(eq(commissionPricingPresets.id, id)).then(r => r[0]); },
  async deleteCommissionPricingPreset(id: number) { return await db.delete(commissionPricingPresets).where(eq(commissionPricingPresets.id, id)); },

  // v4 Global Search — uses raw SQLite for LIKE queries across user's accessible projects
  async globalSearch(userId: number, q: string, limit = 20) {
      const likeQ = `%${q.toLowerCase()}%`;
      // Get user's accessible project IDs
      const memberRows = await db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, userId));
      const ownedProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.ownerId, userId));
      const allIds = memberRows.map(r => r.projectId).concat(ownedProjects.map(r => r.id));
      const projectIds = Array.from(new Set(allIds));
      if (projectIds.length === 0) return { projects: [], scenes: [], scripts: [], assets: [], comments: [] };
      const pIdList = projectIds.join(',');

      const matchedProjects: any[] = [];

      const matchedScenes: any[] = [];

      const matchedScripts: any[] = [];

      const matchedAssets: any[] = [];

      const matchedComments: any[] = [];

      return {
        projects: matchedProjects,
        scenes: matchedScenes,
        scripts: matchedScripts,
        assets: matchedAssets,
        comments: matchedComments,
      };
    },

  // v5 Agent 5
  async getCommissionHours(commissionId: number) { return await db.select().from(dltCommissionHours).where(eq(dltCommissionHours.commissionId, commissionId)); },
  async addCommissionHours(hours: InsertDltCommissionHours) { return await db.insert(dltCommissionHours).values({ ...hours, loggedAt: new Date() }).returning().then(r => r[0] as any); },
  async createAudVoiceTake(take: InsertAudVoiceTake) { return await db.insert(audVoiceTakes).values(take).returning().then(r => r[0] as any); },
  
  async getAudVoiceTakesByProject(projectId: number) { return await db.select().from(audVoiceTakes).where(eq(audVoiceTakes.projectId, projectId)); },
  
  async createAudCaption(caption: InsertAudCaption) { return await db.insert(audCaptions).values(caption).returning().then(r => r[0] as any); },
  async getAudCaption(id: number) { return await db.select().from(audCaptions).where(eq(audCaptions.id, id)).then(r => r[0]); },
  async getAudCaptionsByAnimatic(animaticProjectId: number) { return await db.select().from(audCaptions).where(eq(audCaptions.animaticProjectId, animaticProjectId)); },
    
  async deleteAudCaption(id: number) { return await db.delete(audCaptions).where(eq(audCaptions.id, id)); },

  async getCliApprovals(projectId: number) { return await db.select().from(cli_approvals).where(eq(cli_approvals.projectId, projectId)); },
  
  async createCliApproval(data: Partial<typeof cli_approvals.$inferInsert>) { return await db.insert(cli_approvals).values(data as any).returning().then(r => r[0] as any); },

  async getCliFeedback(projectId: number) { return await db.select().from(cli_feedback).where(eq(cli_feedback.projectId, projectId)); },
    
  async createCliFeedback(data: Partial<typeof cli_feedback.$inferInsert>) { return await db.insert(cli_feedback).values({ ...data, createdAt: new Date() } as any).returning().then(r => r[0] as any); },

  async getA11yPrefs(userId: number) { return await db.select().from(a11y_user_prefs).where(eq(a11y_user_prefs.userId, userId)).then(r => r[0]); },
  
  async createA11yPrefs(prefs: InsertA11yPrefs) { return await db.insert(a11y_user_prefs).values(prefs).returning().then(r => r[0] as any); },
  
  async updateA11yPrefs(userId: number, patch: Partial<InsertA11yPrefs>) {
      const existing = await db.select().from(a11y_user_prefs).where(eq(a11y_user_prefs.userId, userId)).then(r => r[0]);
      if (existing) {
        return await db.update(a11y_user_prefs).set(patch).where(eq(a11y_user_prefs.userId, userId)).returning().then(r => r[0] as any);
      }
      return await db.insert(a11y_user_prefs).values({
        userId,
        focusMode: patch.focusMode || 0,
        dyslexia: patch.dyslexia || 0,
        colorblind: patch.colorblind || 0,
        reducedMotion: patch.reducedMotion || 0,
        largeTouch: patch.largeTouch || 0,
        audioCues: patch.audioCues || 0,
      }).returning().then(r => r[0] as any);
    },

  async listChallengePrompts() { return await db.select().from(challenge_prompts).orderBy(desc(challenge_prompts.weekNumber)); },
  
  async listChallengeSubmissions(userId: number) { return await db.select().from(challenge_submissions).where(eq(challenge_submissions.userId, userId)); },

  async createChallengeSubmission(submission: InsertChallengeSubmission & { userId: number }) { return await db.insert(challenge_submissions).values({ ...submission, createdAt: new Date() }).returning().then(r => r[0] as any); },

  async listChallengeFeed(userId: number, opts?: { limit?: number; offset?: number }) {
      const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 100);
      const offset = Math.max(opts?.offset ?? 0, 0);
      const prompts = await db.select().from(challenge_prompts);
      const submissions = await db
        .select()
        .from(challenge_submissions)
        .orderBy(desc(challenge_submissions.createdAt))
        .limit(limit)
        .offset(offset);
      if (submissions.length === 0) return { items: [], total: 0, limit, offset };
      const submissionIds = submissions.map((s) => s.id);
      const reactions = await db
        .select()
        .from(challenge_reactions)
        .where(inArray(challenge_reactions.submissionId, submissionIds));
      const totalRow = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(challenge_submissions);
      const items = submissions.map((submission) => {
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
      return { items, total: totalRow[0]?.count ?? items.length, limit, offset };
    },

  async toggleChallengeReaction(submissionId: number, userId: number, sticker: string) {
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
      }).returning().then(r => r[0] as any);
      return { active: true, reaction };
    },

  // Studio Render Budget
  async getStudioRenderBudget(projectId: number) { return await db.select().from(studio_render_budget).where(eq(studio_render_budget.projectId, projectId)).then(r => r[0]); },
  async upsertStudioRenderBudget(projectId: number, totalMinutes: number) {
      const existing = await db.select().from(studio_render_budget).where(eq(studio_render_budget.projectId, projectId)).then(r => r[0]);
      const now = new Date();
      if (existing) {
        return await db.update(studio_render_budget).set({ totalMinutes, updatedAt: now }).where(eq(studio_render_budget.projectId, projectId)).returning().then(r => r[0] as any)!;
      }
      return await db.insert(studio_render_budget).values({ projectId, totalMinutes, updatedAt: now }).returning().then(r => r[0] as any);
    },

  // Studio Render Events
  async listStudioRenderEvents(projectId: number) { return await db.select().from(studio_render_events).where(eq(studio_render_events.projectId, projectId)).orderBy(asc(studio_render_events.createdAt)); },
  async createStudioRenderEvent(data: InsertStudioRenderEvent) { return await db.insert(studio_render_events).values({ ...data, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async deleteStudioRenderEvent(id: number) { return await db.delete(studio_render_events).where(eq(studio_render_events.id, id)); },

  // Studio Snapshots
  async listStudioSnapshots(projectId: number) { return await db.select().from(studio_snapshots).where(eq(studio_snapshots.projectId, projectId)).orderBy(asc(studio_snapshots.createdAt)); },
  async createStudioSnapshot(data: InsertStudioSnapshot) { return await db.insert(studio_snapshots).values({ ...data, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async deleteStudioSnapshot(id: number) { return await db.delete(studio_snapshots).where(eq(studio_snapshots.id, id)); },
  async getStudioSnapshot(id: number) { return await db.select().from(studio_snapshots).where(eq(studio_snapshots.id, id)).then(r => r[0]); },
  async restoreStudioSnapshot(snapshotId: number, projectId: number) { return await db.insert(studio_snapshots).values({
        projectId,
        label: `Restored from #${snapshotId}`,
        parentId: snapshotId,
        restoredFromId: snapshotId,
        createdAt: new Date(),
      }).returning().then(r => r[0] as any); },

  // Studio Credit Entries
  async listStudioCreditEntries(projectId: number) { return await db.select().from(studio_credit_entries).where(eq(studio_credit_entries.projectId, projectId)).orderBy(asc(studio_credit_entries.orderIdx)); },
  async createStudioCreditEntry(data: InsertStudioCreditEntry) { return await db.insert(studio_credit_entries).values({ ...data, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async updateStudioCreditEntry(id: number, patch: Partial<InsertStudioCreditEntry>) { return await db.update(studio_credit_entries).set(patch).where(eq(studio_credit_entries.id, id)).returning().then(r => r[0] as any); },
  async deleteStudioCreditEntry(id: number) { return await db.delete(studio_credit_entries).where(eq(studio_credit_entries.id, id)); },
  async replaceStudioCreditEntries(projectId: number, entries: InsertStudioCreditEntry[]) {
      await db.delete(studio_credit_entries).where(eq(studio_credit_entries.projectId, projectId));
      const now = new Date();
      const result: StudioCreditEntry[] = [];
      for (const e of entries) {
        result.push(await db.insert(studio_credit_entries).values({ ...e, createdAt: now }).returning().then(r => r[0] as any));
      }
      return result;
    },

  // === LORE ADDITIONS START ===
  async listLorFacts(projectId: number) { return await db.select().from(lor_continuity_facts).where(eq(lor_continuity_facts.projectId, projectId)); },
  async createLorFact(f: InsertLorContinuityFact) { return await db.insert(lor_continuity_facts).values({ ...f, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async updateLorFact(id: number, patch: Partial<InsertLorContinuityFact>) { return await db.update(lor_continuity_facts).set(patch).where(eq(lor_continuity_facts.id, id)).returning().then(r => r[0] as any); },
  async deleteLorFact(id: number) { return await db.delete(lor_continuity_facts).where(eq(lor_continuity_facts.id, id)); },
  async getLorFact(id: number) { return await db.select().from(lor_continuity_facts).where(eq(lor_continuity_facts.id, id)).then(r => r[0]); },

  async listLorPalettes(projectId: number) { return await db.select().from(lor_palettes).where(eq(lor_palettes.projectId, projectId)); },
  async createLorPalette(p: InsertLorPalette) { return await db.insert(lor_palettes).values({ ...p, createdAt: new Date() }).returning().then(r => r[0] as any); },
  async deleteLorPalette(id: number) { return await db.delete(lor_palettes).where(eq(lor_palettes.id, id)); },
  async getLorPalette(id: number) { return await db.select().from(lor_palettes).where(eq(lor_palettes.id, id)).then(r => r[0]); },

  async listLorAssetVersions(assetId: number) { return await db.select().from(lor_asset_versions).where(eq(lor_asset_versions.assetId, assetId)).orderBy(desc(lor_asset_versions.versionNum)); },
  async createLorAssetVersion(v: InsertLorAssetVersion) { return await db.insert(lor_asset_versions).values({ ...v, uploadedAt: new Date() }).returning().then(r => r[0] as any); },
  async updateLorAssetVersionsForAsset(assetId: number, patch: Partial<LorAssetVersion>) { return await db.update(lor_asset_versions).set(patch).where(eq(lor_asset_versions.assetId, assetId)); },
  async updateLorAssetVersion(id: number, patch: Partial<LorAssetVersion>) { return await db.update(lor_asset_versions).set(patch).where(eq(lor_asset_versions.id, id)).returning().then(r => r[0] as any); },
  async getLorAssetVersion(id: number) { return await db.select().from(lor_asset_versions).where(eq(lor_asset_versions.id, id)).then(r => r[0]); },

  async listLorCasting(projectId: number) { return await db.select().from(lor_casting_matrix).where(eq(lor_casting_matrix.projectId, projectId)); },
  async upsertLorCasting(projectId: number, sceneId: number, entityId: number, present: boolean) {
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
};

export const storage = {
  ...coreStorage,
  ...extraStorage,
};

export type Storage = typeof storage;
