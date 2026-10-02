import { requireAuth, canAccessProject } from "./auth";
import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { insertStudioRenderEventSchema, insertStudioSnapshotSchema, insertStudioCreditEntrySchema } from "@shared/studio_schema";

/** Extract bearer token */
export function registerStudioRoutes(app: Express) {
  // ===== RENDER BUDGET =====
  app.get("/api/projects/:id/studio/render-budget", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const budget = await storage.getStudioRenderBudget(id) ?? { projectId: id, totalMinutes: 600, updatedAt: "" };
    const events = await storage.listStudioRenderEvents(id);
    res.json({ budget, events });
  });

  app.put("/api/projects/:id/studio/render-budget", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({ totalMinutes: z.number().positive() });
    let body: { totalMinutes: number };
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const budget = await storage.upsertStudioRenderBudget(id, body.totalMinutes);
    res.json(budget);
  });

  // ===== RENDER EVENTS =====
  app.post("/api/projects/:id/studio/render-events", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = insertStudioRenderEventSchema.extend({ projectId: z.number().optional() });
    let body: any;
    try { body = schema.parse({ ...req.body, projectId: id }); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const event = await storage.createStudioRenderEvent({ ...body, projectId: id });
    res.json(event);
  });

  app.delete("/api/projects/:id/studio/render-events/:eventId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const eventId = parseInt(String(req.params.eventId), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteStudioRenderEvent(eventId);
    res.json({ ok: true });
  });

  // ===== SNAPSHOTS =====
  app.get("/api/projects/:id/studio/snapshots", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const snapshots = await storage.listStudioSnapshots(id);
    res.json(snapshots);
  });

  app.post("/api/projects/:id/studio/snapshots", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      label: z.string().min(1),
      parentId: z.number().int().nullable().optional(),
      notes: z.string().nullable().optional(),
    });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const snapshot = await storage.createStudioSnapshot({
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
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const snap = await storage.getStudioSnapshot(snapId);
    if (!snap || snap.projectId !== id) return res.status(404).json({ message: "Snapshot not found" });
    const restored = await storage.restoreStudioSnapshot(snapId, id);
    res.json(restored);
  });

  app.delete("/api/projects/:id/studio/snapshots/:snapId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const snapId = parseInt(String(req.params.snapId), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteStudioSnapshot(snapId);
    res.json({ ok: true });
  });

  // ===== CREDIT ENTRIES =====
  app.get("/api/projects/:id/studio/credits", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const entries = await storage.listStudioCreditEntries(id);
    res.json(entries);
  });

  app.post("/api/projects/:id/studio/credits", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      section: z.enum(["cast", "crew"]),
      role: z.string().min(1),
      name: z.string().min(1),
      orderIdx: z.number().int().optional().default(0),
    });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const entry = await storage.createStudioCreditEntry({ ...body, projectId: id });
    res.json(entry);
  });

  // Bulk save (replaces all entries for project)
  app.put("/api/projects/:id/studio/credits", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.array(z.object({
      section: z.enum(["cast", "crew"]),
      role: z.string().min(1),
      name: z.string().min(1),
      orderIdx: z.number().int().optional().default(0),
    }));
    let body: any[];
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const entries = await storage.replaceStudioCreditEntries(id, body.map((e: any) => ({ ...e, projectId: id })));
    res.json(entries);
  });

  app.delete("/api/projects/:id/studio/credits/:entryId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const entryId = parseInt(String(req.params.entryId), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteStudioCreditEntry(entryId);
    res.json({ ok: true });
  });
}
