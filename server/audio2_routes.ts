import type { Express, Request, Response, NextFunction } from "express";
import { db, getSessionUser, storage } from "./storage";
import { eq } from "drizzle-orm";
import { audio2_lipsync, audio2_cues, insertAudio2LipsyncSchema, insertAudio2CueSchema } from "../shared/audio2_schema";
import { projects } from "../shared/schema";
import { z } from "zod";

async function canAccessProject(projectId: number, userId: number): Promise<boolean> {
  const p = await storage.getProject(projectId);
  if (!p) return false;
  if (p.ownerId === userId) return true;
  return await storage.isMember(projectId, userId);
}

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
  (req as any).user = user;
  next();
}

export function registerAudio2Routes(app: Express) {
  
  // Lipsync Routes
  app.get("/api/projects/:id/lipsync", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    if (!canAccessProject(projectId, userId)) return res.status(403).json({ message: "Forbidden" });

    const results = db.select().from(audio2_lipsync).where(eq(audio2_lipsync.projectId, projectId)).all();
    res.json(results);
  });

  app.post("/api/projects/:id/lipsync", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    if (!canAccessProject(projectId, userId)) return res.status(403).json({ message: "Forbidden" });

    const parsed = insertAudio2LipsyncSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const inserted = db.insert(audio2_lipsync).values({
      ...parsed.data,
      projectId,
      createdAt: new Date().toISOString()
    }).returning().get();
    res.json(inserted);
  });
  
  app.put("/api/lipsync/:id", requireAuth, async (req, res) => {
    const lipsyncId = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    
    const lipsync = db.select().from(audio2_lipsync).where(eq(audio2_lipsync.id, lipsyncId)).get();
    if (!lipsync) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(lipsync.projectId, userId)) return res.status(403).json({ message: "Forbidden" });

    const updateSchema = z.object({
      transcript: z.string().optional(),
      timelineJson: z.string().optional(),
    });
    
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const updated = db.update(audio2_lipsync).set(parsed.data).where(eq(audio2_lipsync.id, lipsyncId)).returning().get();
    res.json(updated);
  });

  app.delete("/api/lipsync/:id", requireAuth, async (req, res) => {
    const lipsyncId = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    
    const lipsync = db.select().from(audio2_lipsync).where(eq(audio2_lipsync.id, lipsyncId)).get();
    if (!lipsync) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(lipsync.projectId, userId)) return res.status(403).json({ message: "Forbidden" });

    db.delete(audio2_lipsync).where(eq(audio2_lipsync.id, lipsyncId)).run();
    res.json({ success: true });
  });

  // Cues Routes
  app.get("/api/projects/:id/cues", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    if (!canAccessProject(projectId, userId)) return res.status(403).json({ message: "Forbidden" });

    const results = db.select().from(audio2_cues).where(eq(audio2_cues.projectId, projectId)).all();
    res.json(results);
  });

  app.post("/api/projects/:id/cues", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    if (!canAccessProject(projectId, userId)) return res.status(403).json({ message: "Forbidden" });

    const parsed = insertAudio2CueSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const inserted = db.insert(audio2_cues).values({
      ...parsed.data,
      projectId,
      createdAt: new Date().toISOString()
    }).returning().get();
    res.json(inserted);
  });

  app.put("/api/cues/:id", requireAuth, async (req, res) => {
    const cueId = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    
    const cue = db.select().from(audio2_cues).where(eq(audio2_cues.id, cueId)).get();
    if (!cue) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(cue.projectId, userId)) return res.status(403).json({ message: "Forbidden" });

    const updateSchema = z.object({
      timestampMs: z.number().optional(),
      label: z.string().optional(),
      color: z.string().optional(),
    });
    
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const updated = db.update(audio2_cues).set(parsed.data).where(eq(audio2_cues.id, cueId)).returning().get();
    res.json(updated);
  });

  app.delete("/api/cues/:id", requireAuth, async (req, res) => {
    const cueId = parseInt(String(req.params.id), 10);
    const userId = (req as any).user.id;
    
    const cue = db.select().from(audio2_cues).where(eq(audio2_cues.id, cueId)).get();
    if (!cue) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(cue.projectId, userId)) return res.status(403).json({ message: "Forbidden" });

    db.delete(audio2_cues).where(eq(audio2_cues.id, cueId)).run();
    res.json({ success: true });
  });

}
