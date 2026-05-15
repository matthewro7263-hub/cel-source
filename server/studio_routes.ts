import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage, getSessionUser } from "./storage";
import { insertStudioRenderEventSchema, insertStudioSnapshotSchema, insertStudioCreditEntrySchema } from "@shared/studio_schema";

/** Extract bearer token */
function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth) return undefined;
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return undefined;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const userId = getSessionUser(token);
  if (!userId) return res.status(401).json({ message: "Not authenticated" });
  const user = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "User not found" });
  req.user = user;
  next();
}

async function canAccessProject(projectId: number, userId: number): Promise<boolean> {
  const p = await storage.getProject(projectId);
  if (!p) return false;
  if (p.ownerId === userId) return true;
  return await storage.isMember(projectId, userId);
}

export function registerStudioRoutes(app: Express) {
  // ===== RENDER BUDGET =====
  app.get("/api/projects/:id/studio/render-budget", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const budget = await (storage as any).getStudioRenderBudget(id) ?? { projectId: id, totalMinutes: 600, updatedAt: "" };
    const events = await (storage as any).listStudioRenderEvents(id);
    res.json({ budget, events });
  });

  app.put("/api/projects/:id/studio/render-budget", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({ totalMinutes: z.number().positive() });
    let body: { totalMinutes: number };
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const budget = await (storage as any).upsertStudioRenderBudget(id, body.totalMinutes);
    res.json(budget);
  });

  // ===== RENDER EVENTS =====
  app.post("/api/projects/:id/studio/render-events", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = insertStudioRenderEventSchema.extend({ projectId: z.number().optional() });
    let body: any;
    try { body = schema.parse({ ...req.body, projectId: id }); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const event = await (storage as any).createStudioRenderEvent({ ...body, projectId: id });
    res.json(event);
  });

  app.delete("/api/projects/:id/studio/render-events/:eventId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const eventId = parseInt(String(req.params.eventId), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    await (storage as any).deleteStudioRenderEvent(eventId);
    res.json({ ok: true });
  });

  // ===== SNAPSHOTS =====
  app.get("/api/projects/:id/studio/snapshots", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const snapshots = await (storage as any).listStudioSnapshots(id);
    res.json(snapshots);
  });

  app.post("/api/projects/:id/studio/snapshots", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      label: z.string().min(1),
      parentId: z.number().int().nullable().optional(),
      notes: z.string().nullable().optional(),
    });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const snapshot = await (storage as any).createStudioSnapshot({
      projectId: id,
      label: body.label,
      parentId: body.parentId ?? null,
      notes: body.notes ?? null,
      restoredFromId: null,
    });
    res.json(snapshot);
  });

  app.post("/api/projects/:id/studio/snapshots/:snapId/restore", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const snapId = parseInt(String(req.params.snapId), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const snap = await (storage as any).getStudioSnapshot(snapId);
    if (!snap || snap.projectId !== id) return res.status(404).json({ message: "Snapshot not found" });
    const restored = await (storage as any).restoreStudioSnapshot(snapId, id);
    res.json(restored);
  });

  app.delete("/api/projects/:id/studio/snapshots/:snapId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const snapId = parseInt(String(req.params.snapId), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    await (storage as any).deleteStudioSnapshot(snapId);
    res.json({ ok: true });
  });

  // ===== CREDIT ENTRIES =====
  app.get("/api/projects/:id/studio/credits", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const entries = await (storage as any).listStudioCreditEntries(id);
    res.json(entries);
  });

  app.post("/api/projects/:id/studio/credits", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      section: z.enum(["cast", "crew"]),
      role: z.string().min(1),
      name: z.string().min(1),
      orderIdx: z.number().int().optional().default(0),
    });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const entry = await (storage as any).createStudioCreditEntry({ ...body, projectId: id });
    res.json(entry);
  });

  // Bulk save (replaces all entries for project)
  app.put("/api/projects/:id/studio/credits", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.array(z.object({
      section: z.enum(["cast", "crew"]),
      role: z.string().min(1),
      name: z.string().min(1),
      orderIdx: z.number().int().optional().default(0),
    }));
    let body: any[];
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const entries = await (storage as any).replaceStudioCreditEntries(id, body.map((e: any) => ({ ...e, projectId: id })));
    res.json(entries);
  });

  app.delete("/api/projects/:id/studio/credits/:entryId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const entryId = parseInt(String(req.params.entryId), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    await (storage as any).deleteStudioCreditEntry(entryId);
    res.json({ ok: true });
  });
}
