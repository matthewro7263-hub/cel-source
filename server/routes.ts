import multer from "multer";
import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import mammoth from "mammoth";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import type { Express, Request, Response, NextFunction } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { z } from "zod";
import {
  storage, db, hashPassword, verifyPassword, createSession,
  getSessionUser, destroySession, genToken,
} from "./storage";
import {
  insertCommissionSchema,
  audVoiceTakes, insertAudVoiceTakeSchema, audCaptions, insertAudCaptionSchema,
  dltCommissionHours, sceneTimeEntries, scenes, commissions, projects
} from "@shared/schema";
import { eq } from "drizzle-orm";
import type { User as AppUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends AppUser {}
  }
}


/** Extract bearer token from Authorization header */
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

import { bakRouter } from "./routes/bak/index.js";
import { registerStudioRoutes } from "./studio_routes";
import { registerA11yRoutes } from "./a11y_routes";
import { registerChallengeRoutes } from "./challenge_routes";
import { registerReviewRoom } from "./review_room";
import { registerMcpRoutes } from "./mcp_routes";
import { registerBizRoutes } from "./biz_routes";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

  registerReviewRoom(httpServer);
  registerMcpRoutes(app);

  app.use("/api", bakRouter);

  registerBizRoutes(app);

  registerStudioRoutes(app);

  registerA11yRoutes(app);
  registerChallengeRoutes(app);

  // No cookie-parser — we use Authorization: Bearer <token> only

  // ===== AUTH =====
  app.post("/api/auth/signup", async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1).max(80),
      password: z.string().min(8).max(200),
    });
    const body = schema.parse(req.body);
    const existing = await storage.getUserByEmail(body.email);
    if (existing) return res.status(400).json({ message: "Email already in use" });
    const colors = ["#6E4FE8", "#E8744F", "#4FBFE8", "#E84F9F", "#4FE89A", "#E8C44F"];
    const user = await storage.createUser({
      email: body.email,
      name: body.name,
      passwordHash: hashPassword(body.password),
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
    });
    const token = createSession(user.id);
    const { passwordHash, ...safe } = user;
    res.json({ user: safe, token });
  });

  app.post("/api/auth/login", async (req, res) => {
    const schema = z.object({ email: z.string().email(), password: z.string() });
    const body = schema.parse(req.body);
    const user = await storage.getUserByEmail(body.email);
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = createSession(user.id);
    const { passwordHash, ...safe } = user;
    res.json({ user: safe, token });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = extractToken(req);
    if (token) destroySession(token);
    res.json({ ok: true });
  });

  app.get("/api/auth/me", async (req, res) => {
    const token = extractToken(req);
    const userId = getSessionUser(token);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    const { passwordHash, ...safe } = user;
    res.json(safe);
  });

  app.patch("/api/auth/me", requireAuth, async (req, res) => {
    const schema = z.object({ name: z.string().min(1).optional(), avatarColor: z.string().optional() });
    const patch = schema.parse(req.body);
    const updated = await storage.updateUser(req.user!.id, patch);
    const { passwordHash, ...safe } = updated!;
    res.json(safe);
  });

  // ===== PROJECTS =====
  app.get ("/api/projects", requireAuth, async (req, res) => {
    const list = await storage.listProjectsForUser(req.user!.id);
    res.json(list);
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional().default(""),
      coverColor: z.string().optional().default("#6E4FE8"),
      deadline: z.string().nullable().optional(),
    });
    const body = schema.parse(req.body);
    const p = await storage.createProject({
      ownerId: req.user!.id,
      title: body.title,
      description: body.description || "",
      coverColor: body.coverColor || "#6E4FE8",
      deadline: body.deadline ?? null,
      status: "active",
      shareToken: genToken(16),
      shareEnabled: false,
    });
    await storage.addMember({ projectId: p.id, userId: req.user!.id, role: "owner" });
    res.json(p);
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const p = await storage.getProject(id);
    const members = await storage.listMembers(id).map((m) => ({
      ...m,
      user: m.user ? { id: m.user.id, name: m.user.name, email: m.user.email, avatarColor: m.user.avatarColor } : null,
    }));
    res.json({ project: p, members });
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      deadline: z.string().nullable().optional(),
      coverColor: z.string().optional(),
      status: z.string().optional(),
      shareEnabled: z.boolean().optional(),
      cli_brandLogo: z.string().optional().nullable(),
      cli_brandColor: z.string().optional(),
      cli_brandWelcome: z.string().optional().nullable(),
      dltDiscordWebhookUrl: z.string().url().nullable().optional(),
    });
    const patch = schema.parse(req.body);
    const updated = await storage.updateProject(id, patch as any);
    res.json(updated);
  });

  app.delete ("/api/projects/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const p = await storage.getProject(id);
    if (!p) return res.status(404).json({ message: "Not found" });
    if (p.ownerId !== req.user!.id) return res.status(403).json({ message: "Only the owner can delete" });
    await storage.deleteProject(id);
    res.json({ ok: true });
  });

  // ===== MEMBERS =====
  app.post("/api/projects/:id/members", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({ email: z.string().email(), role: z.string().optional() });
    const body = schema.parse(req.body);
    let user = await storage.getUserByEmail(body.email);
    let tempPassword: string | undefined;
    if (!user) {
      tempPassword = "changeme";
      const colors = ["#6E4FE8", "#E8744F", "#4FBFE8", "#E84F9F", "#4FE89A"];
      user = await storage.createUser({
        email: body.email,
        name: body.email.split("@")[0],
        passwordHash: hashPassword(tempPassword),
        avatarColor: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    if (!await storage.isMember(id, user.id)) {
      await storage.addMember({ projectId: id, userId: user.id, role: body.role || "editor" });
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor }, tempPassword });
  });

  app.delete("/api/projects/:id/members/:userId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = parseInt(String(req.params.userId), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.removeMember(id, userId);
    res.json({ ok: true });
  });

  // ===== SCRIPTS =====
  // ===== SCRIPT UPLOADS =====
  app.post("/api/projects/:projectId/scripts/upload", requireAuth, upload.single("file"), async (req, res) => {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (!canAccessProject(projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const mimetype = req.file.mimetype;
    const originalname = req.file.originalname;
    const buffer = req.file.buffer;

    // Validate MIME type
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/markdown",
      "text/plain"
    ];

    const extension = originalname.split('.').pop()?.toLowerCase();
    
    const isMarkdown = mimetype === "text/markdown" || extension === "md";
    const isTxt = mimetype === "text/plain" || extension === "txt";
    const isPdf = mimetype === "application/pdf" || extension === "pdf";
    const isDocx = mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension === "docx";

    if (!isMarkdown && !isTxt && !isPdf && !isDocx && !allowedMimeTypes.includes(mimetype)) {
      return res.status(400).json({ message: "Invalid file type. Only PDF, DOCX, MD, and TXT are allowed." });
    }

    let sourceFormat = "";
    if (isPdf) sourceFormat = "pdf";
    else if (isDocx) sourceFormat = "docx";
    else if (isMarkdown) sourceFormat = "md";
    else if (isTxt) sourceFormat = "txt";

    try {
      let extractedText = "";

      if (sourceFormat === "pdf") {
        const data = await pdfParse(buffer);
        extractedText = data.text;
      } else if (sourceFormat === "docx") {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } else {
        extractedText = buffer.toString("utf8");
      }

      if (!extractedText.trim()) {
        return res.status(400).json({
          message: "No readable text found in this file. Try exporting the script as a text-based PDF, DOCX, TXT, or Markdown file.",
        });
      }

      if (!process.env.R2_BUCKET || !process.env.R2_ENDPOINT) {
        throw new Error("Cloud storage (R2) is not configured on this server.");
      }

      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const r2Client = new S3Client({
        region: "auto",
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });

      const safeName = originalname.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
      const originalKey = `uploads/${req.user!.id}/scripts/${randomUUID()}-${safeName}`;

      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: originalKey,
        ContentType: mimetype,
        Body: buffer
      }));

      const title = originalname.replace(/\.[^/.]+$/, "");

      const newScript = await (storage as any).createScript({
        projectId,
        title,
        content: extractedText,
      });

      const { scripts } = await import("@shared/schema.js");
      const { eq } = await import("drizzle-orm");

      db.update(scripts).set({
        sourceType: "upload",
        sourceFormat,
        originalKey
      }).where(eq(scripts.id, newScript.id)).run();
      
      const updatedScript = await (storage as any).getScript(newScript.id);

      res.json(updatedScript);
    } catch (e: any) {
      console.error("Upload error:", e);
      res.status(500).json({ message: `Failed to process script: ${e.message}` });
    }
  });

  app.get("/api/projects/:projectId/scripts/:scriptId/original", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.projectId), 10);
    const scriptId = parseInt(String(req.params.scriptId), 10);
    
    if (!canAccessProject(projectId, req.user!.id)) return res.status(403).json({ message: "No access" });

    const script = await (storage as any).getScript(scriptId);
    if (!script) return res.status(404).json({ message: "Script not found" });
    if (script.projectId !== projectId) return res.status(403).json({ message: "Script belongs to another project" });
    if (script.sourceType !== "upload" || !script.originalKey) {
      return res.status(400).json({ message: "No original file available for this script" });
    }

    try {
      if (!process.env.R2_BUCKET || !process.env.R2_ENDPOINT) {
        throw new Error("Cloud storage (R2) is not configured on this server.");
      }
      const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      
      const r2Client = new S3Client({
        region: "auto",
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });

      const url = await getSignedUrl(r2Client, new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: script.originalKey,
      }), { expiresIn: 300 });
      
      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/projects/:id/scripts", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    res.json(await storage.listScripts(id));
  });
  app.post("/api/projects/:id/scripts", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({ title: z.string().optional(), content: z.string().optional() });
    const body = schema.parse(req.body);
    res.json(await storage.createScript({ projectId: id, title: body.title || "Untitled Script", content: body.content || "" }));
  });
  app.patch("/api/projects/:id/scripts/:scriptId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const sid = parseInt(String(req.params.scriptId), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({ title: z.string().optional(), content: z.string().optional() });
    const patch = schema.parse(req.body);
    res.json(await storage.updateScript(sid, patch));
  });
  app.delete("/api/projects/:id/scripts/:scriptId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const sid = parseInt(String(req.params.scriptId), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deleteScript(sid);
    res.json({ ok: true });
  });

  // ===== STORYBOARDS =====
  app.get("/api/projects/:id/storyboards", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const sbs = await storage.listStoryboards(id);
    const out = sbs.map(async (sb) => ({ ...sb, panels: await storage.listPanels(sb.id) }));
    res.json(out);
  });
  app.post("/api/projects/:id/storyboards", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({ title: z.string().optional() });
    const body = schema.parse(req.body);
    res.json(await storage.createStoryboard({ projectId: id, title: body.title || "Untitled Storyboard" }));
  });
  app.delete("/api/projects/:id/storyboards/:sbId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const sb = parseInt(String(req.params.sbId), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deleteStoryboard(sb);
    res.json({ ok: true });
  });

  // ===== PANELS =====
  app.post ("/api/storyboards/:sbId/panels", requireAuth, async (req, res) => {
    const sbId = parseInt(String(req.params.sbId), 10);
    const sb = await storage.getStoryboard(sbId);
    if (!sb) return res.status(404).json({ message: "Storyboard not found" });
    if (!canAccessProject(sb.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      imageData: z.string().min(1),
      caption: z.string().optional().default(""),
      dialogue: z.string().optional().default(""),
    });
    const body = schema.parse(req.body);
    if (body.imageData.length > 14 * 1024 * 1024) {
      return res.status(413).json({ message: "Image too large (max 10MB)" });
    }
    const panels = await storage.listPanels(sbId);
    const orderIdx = panels.length;
    const panel = await storage.createPanel({
      storyboardId: sbId,
      orderIdx,
      imageData: body.imageData,
      caption: body.caption || "",
      dialogue: body.dialogue || "",
    });
    res.json(panel);
  });
  app.patch ("/api/panels/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const panel = await storage.getPanel(id);
    if (!panel) return res.status(404).json({ message: "Not found" });
    const sb = await storage.getStoryboard(panel.storyboardId);
    if (!sb || !canAccessProject(sb.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      orderIdx: z.number().int().optional(),
      caption: z.string().optional(),
      dialogue: z.string().optional(),
    });
    const patch = schema.parse(req.body);
    res.json(await storage.updatePanel(id, patch));
  });
  app.delete ("/api/panels/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const panel = await storage.getPanel(id);
    if (!panel) return res.status(404).json({ message: "Not found" });
    const sb = await storage.getStoryboard(panel.storyboardId);
    if (!sb || !canAccessProject(sb.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deletePanel(id);
    res.json({ ok: true });
  });

  // ===== ANIMATICS =====
  app.get("/api/projects/:id/animatics", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    res.json(await storage.listAnimatics(id));
  });
  app.post("/api/projects/:id/animatics", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      title: z.string().optional(),
      videoData: z.string().min(1),
      notes: z.string().optional().default(""),
    });
    const body = schema.parse(req.body);
    if (body.videoData.length > 14 * 1024 * 1024) {
      return res.status(413).json({ message: "Video too large (max 10MB). Try a YouTube/Vimeo URL instead." });
    }
    const created = await storage.createAnimatic({
      projectId: id, title: body.title || "Animatic", videoData: body.videoData, notes: body.notes || "",
    });
    notifyDiscord(id, `Animatic Published`, `Animatic "${created.title}" has been published.`);
    res.json(created);
  });
  app.delete("/api/projects/:id/animatics/:aId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const aId = parseInt(String(req.params.aId), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deleteAnimatic(aId);
    res.json({ ok: true });
  });

  // ===== SCENES =====
  app.get("/api/projects/:id/scenes", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    res.json(await storage.listScenes(id));
  });
  app.post("/api/projects/:id/scenes", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      number: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      deadline: z.string().nullable().optional(),
      assigneeId: z.number().nullable().optional(),
    });
    const body = schema.parse(req.body);
    res.json(await storage.createScene({
      projectId: id,
      number: body.number || "1",
      title: body.title || "Untitled Scene",
      description: body.description || "",
      status: body.status || "script",
      deadline: body.deadline ?? null,
      assigneeId: body.assigneeId ?? null,
    }));
  });
  app.patch("/api/projects/:id/scenes/:sceneId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const sceneId = parseInt(String(req.params.sceneId), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      number: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      deadline: z.string().nullable().optional(),
      assigneeId: z.number().nullable().optional(),
    });
    const patch = schema.parse(req.body);
    const updated = await storage.updateScene(sceneId, patch as any);
    
    if (patch.status && updated) {
      notifyDiscord(id, `Scene Status Updated`, `Scene "${updated.title}" is now **${patch.status}**`);
    }
    
    res.json(updated);
  });
  app.delete("/api/projects/:id/scenes/:sceneId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const sceneId = parseInt(String(req.params.sceneId), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deleteScene(sceneId);
    res.json({ ok: true });
  });

  // ===== COMMENTS =====
  app.get("/api/projects/:id/comments", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const list = await storage.listComments(id);
    const enriched = list.map(async (c) => ({ ...c, author: await storage.getUser(c.authorId) || null }));
    res.json(enriched.map((c) => ({
      ...c,
      author: c.author ? { id: c.author.id, name: c.author.name, avatarColor: c.author.avatarColor } : null,
    })));
  });
  app.post("/api/projects/:id/comments", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({ body: z.string().min(1), sceneId: z.number().nullable().optional() });
    const body = schema.parse(req.body);
    const comment = await storage.createComment({
      projectId: id, authorId: req.user!.id, body: body.body, sceneId: body.sceneId ?? null,
    });
    
    notifyDiscord(id, `New Comment from ${req.user!.name}`, body.body);
    
    res.json(comment);
  });
  app.delete("/api/projects/:id/comments/:commentId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const cid = parseInt(String(req.params.commentId), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deleteComment(cid);
    res.json({ ok: true });
  });

  // ===== ASSETS =====
  app.get("/api/projects/:id/assets", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const category = req.query.category as string | undefined;
    // Exclude fileData from listing for performance; client fetches individual for download
    const list = await storage.listAssets(id, category);
    const safe = list.map(({ fileData, ...rest }) => rest);
    res.json(safe);
  });

  app.post("/api/projects/:id/assets", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      category: z.string().optional().default("Other"),
      filename: z.string().min(1),
      mimeType: z.string().optional().default(""),
      fileData: z.string().min(1),
      thumbnailData: z.string().nullable().optional(),
      notes: z.string().optional().default(""),
      tags: z.string().optional().default(""),
    });
    const body = schema.parse(req.body);
    if (body.fileData.length > 14 * 1024 * 1024) {
      return res.status(413).json({ message: "File too large (max 10MB)" });
    }
    const asset = await storage.createAsset({
      projectId: id,
      uploaderId: req.user!.id,
      ...body,
      thumbnailData: body.thumbnailData ?? null,
    });
    const { fileData, ...safe } = asset;
    res.json(safe);
  });

  app.patch ("/api/assets/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const asset = await storage.getAsset(id);
    if (!asset) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(asset.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      notes: z.string().optional(),
      tags: z.string().optional(),
      category: z.string().optional(),
    });
    const patch = schema.parse(req.body);
    const updated = await storage.updateAsset(id, patch);
    if (!updated) return res.status(404).json({ message: "Not found" });
    const { fileData, ...safe } = updated;
    res.json(safe);
  });

  app.delete ("/api/assets/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const asset = await storage.getAsset(id);
    if (!asset) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(asset.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deleteAsset(id);
    res.json({ ok: true });
  });

  app.get ("/api/assets/:id/download", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const asset = await storage.getAsset(id);
    if (!asset) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(asset.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    // fileData is a base64 data URL — send it as-is for client-side download
    res.json({ fileData: asset.fileData, filename: asset.filename, mimeType: asset.mimeType });
  });

  // ===== COMMISSIONS (public intake) =====
  // In-memory rate limiter: max 5 submissions per IP per hour
  const commissionRateLimit = new Map<string, { count: number; resetAt: number }>();

  app.post("/api/commissions", async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const entry = commissionRateLimit.get(ip);
    if (entry) {
      if (now < entry.resetAt && entry.count >= 5) {
        return res.status(429).json({ message: "Too many submissions. Try again later." });
      }
      if (now >= entry.resetAt) {
        commissionRateLimit.set(ip, { count: 1, resetAt: now + 3600_000 });
      } else {
        entry.count++;
      }
    } else {
      commissionRateLimit.set(ip, { count: 1, resetAt: now + 3600_000 });
    }

    const schema = insertCommissionSchema.extend({
      clientName: z.string().min(1),
      clientEmail: z.string().email(),
      type: z.enum(["Character art", "Animation - 2D", "Animation - 3D", "Storyboard", "Other"]),
      description: z.string().min(1),
      budgetRange: z.enum(["Under $50", "$50-$150", "$150-$500", "$500+", "Discuss"]),
    });
    const body = schema.parse(req.body);
    if (body.referenceImage && body.referenceImage.length > 14 * 1024 * 1024) {
      return res.status(413).json({ message: "Reference image too large (max 10MB)" });
    }
    // Validate that the ownerUserId refers to an existing user
    if (!await storage.getUser(body.ownerUserId)) {
      return res.status(404).json({ message: "Unknown artist" });
    }
    const commission = await storage.createCommission({
      ownerUserId: body.ownerUserId,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      type: body.type,
      description: body.description,
      referenceImage: body.referenceImage ?? null,
      deadline: body.deadline ?? null,
      budgetRange: body.budgetRange,
      status: "new",
      notes: "",
    });
    res.json(commission);
  });

  app.get ("/api/commissions", requireAuth, async (req, res) => {
    const list = await storage.listCommissions(req.user!.id);
    // Omit large reference images from list view
    const safe = list.map(({ referenceImage, ...rest }) => ({ ...rest, hasReferenceImage: !!referenceImage }));
    res.json(safe);
  });

  app.get ("/api/commissions/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const commission = await storage.getCommission(id);
    if (!commission) return res.status(404).json({ message: "Not found" });
    if (commission.ownerUserId !== req.user!.id) return res.status(403).json({ message: "No access" });
    res.json(commission);
  });

  app.patch ("/api/commissions/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const commission = await storage.getCommission(id);
    if (!commission) return res.status(404).json({ message: "Not found" });
    if (commission.ownerUserId !== req.user!.id) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      status: z.string().optional(),
      notes: z.string().optional(),
    });
    const patch = schema.parse(req.body);
    const updated = await storage.updateCommission(id, patch);
    
    // If it's linked to a project and status changed, notify Discord
    if (patch.status && updated?.linkedProjectId) {
      notifyDiscord(updated.linkedProjectId, `Commission Status Updated`, `Commission from ${updated.clientName} is now **${patch.status}**`);
    }
    
    res.json(updated);
  });

  app.post ("/api/commissions/:id/convert", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const commission = await storage.getCommission(id);
    if (!commission) return res.status(404).json({ message: "Not found" });
    if (commission.ownerUserId !== req.user!.id) return res.status(403).json({ message: "No access" });
    const project = await storage.createProject({
      ownerId: req.user!.id,
      title: `Commission for ${commission.clientName}`,
      description: commission.description,
      coverColor: "#6E4FE8",
      deadline: commission.deadline ?? null,
      status: "active",
      shareToken: genToken(16),
      shareEnabled: false,
    });
    await storage.addMember({ projectId: project.id, userId: req.user!.id, role: "owner" });
    await storage.updateCommission(id, { status: "in-progress", linkedProjectId: project.id });
    res.json({ project, commission: await storage.getCommission(id) });
  });

  // ===== RENDERS =====
  app.get ("/api/scenes/:sceneId/renders", requireAuth, async (req, res) => {
    const sceneId = parseInt(String(req.params.sceneId), 10);
    const scene = await storage.getScene(sceneId);
    if (!scene) return res.status(404).json({ message: "Scene not found" });
    if (!canAccessProject(scene.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    res.json(await storage.listRenders(sceneId));
  });

  app.post ("/api/scenes/:sceneId/renders", requireAuth, async (req, res) => {
    const sceneId = parseInt(String(req.params.sceneId), 10);
    const scene = await storage.getScene(sceneId);
    if (!scene) return res.status(404).json({ message: "Scene not found" });
    if (!canAccessProject(scene.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      label: z.string().optional().default("Render"),
      status: z.enum(["queued", "running", "done", "failed"]).optional().default("queued"),
      software: z.enum(["Blender", "Moho", "After Effects", "Other"]).optional().default("Other"),
      durationSeconds: z.number().int().nullable().optional(),
      fileUrl: z.string().optional().default(""),
      notes: z.string().optional().default(""),
    });
    const body = schema.parse(req.body);
    const render = await storage.createRender({
      sceneId,
      label: body.label,
      status: body.status,
      software: body.software,
      durationSeconds: body.durationSeconds ?? null,
      fileUrl: body.fileUrl,
      notes: body.notes,
    });
    res.json(render);
  });

  app.patch ("/api/renders/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const render = await storage.getRender(id);
    if (!render) return res.status(404).json({ message: "Not found" });
    const scene = await storage.getScene(render.sceneId);
    if (!scene || !canAccessProject(scene.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      label: z.string().optional(),
      status: z.string().optional(),
      software: z.string().optional(),
      durationSeconds: z.number().int().nullable().optional(),
      fileUrl: z.string().optional(),
      notes: z.string().optional(),
    });
    const patch = schema.parse(req.body);
    const updated = await storage.updateRender(id, patch as any);
    
    if (patch.status === "done" && updated && render.status !== "done") {
      notifyDiscord(scene.projectId, `Render Complete`, `Render "${updated.label}" for Scene ${scene.number} is ready.`);
    }
    
    res.json(updated);
  });

  app.delete ("/api/renders/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const render = await storage.getRender(id);
    if (!render) return res.status(404).json({ message: "Not found" });
    const scene = await storage.getScene(render.sceneId);
    if (!scene || !canAccessProject(scene.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deleteRender(id);
    res.json({ ok: true });
  });

  // ===== ANIMATIC PROJECTS v2 =====
  app.get("/api/projects/:projectId/animatics-v2", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (!canAccessProject(projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    res.json(await storage.getAnimaticProjectsByProject(projectId));
  });

  app.post("/api/projects/:projectId/animatics-v2", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (!canAccessProject(projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      title: z.string().optional().default("Untitled Animatic"),
      fps: z.number().int().optional().default(24),
      totalDurationMs: z.number().int().optional().default(8000),
    });
    const body = schema.parse(req.body);
    const ap = await storage.createAnimaticProject({ projectId, title: body.title, fps: body.fps, totalDurationMs: body.totalDurationMs });
    res.json(ap);
  });

  app.get ("/api/animatics-v2/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const ap = await storage.getAnimaticProject(id);
    if (!ap) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(ap.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    res.json(ap);
  });

  app.patch ("/api/animatics-v2/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const ap = await storage.getAnimaticProject(id);
    if (!ap) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(ap.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      title: z.string().optional(),
      fps: z.number().int().optional(),
      totalDurationMs: z.number().int().optional(),
    });
    const patch = schema.parse(req.body);
    const updated = await storage.updateAnimaticProject(id, patch);
    res.json(updated);
  });

  app.delete ("/api/animatics-v2/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const ap = await storage.getAnimaticProject(id);
    if (!ap) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(ap.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deleteAnimaticProject(id);
    res.json({ ok: true });
  });

  // ===== ANIMATIC TRACKS =====
  app.post ("/api/animatics-v2/:id/tracks", requireAuth, async (req, res) => {
    const animaticId = parseInt(String(req.params.id), 10);
    const ap = await storage.getAnimaticProject(animaticId);
    if (!ap) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(ap.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      kind: z.string().optional().default("sfx"),
      name: z.string().optional().default("New Track"),
      orderIdx: z.number().int().optional().default(99),
      muted: z.boolean().optional().default(false),
      volume: z.string().optional().default("1.0"),
    });
    const body = schema.parse(req.body);
    const track = await storage.createTrack({ animaticProjectId: animaticId, ...body });
    res.json(track);
  });

  app.patch ("/api/tracks/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const track = await storage.getTrack(id);
    if (!track) return res.status(404).json({ message: "Not found" });
    const ap = await storage.getAnimaticProject(track.animaticProjectId);
    if (!ap || !canAccessProject(ap.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      kind: z.string().optional(),
      name: z.string().optional(),
      orderIdx: z.number().int().optional(),
      muted: z.boolean().optional(),
      volume: z.string().optional(),
    });
    const patch = schema.parse(req.body);
    const updated = await storage.updateTrack(id, patch);
    res.json(updated);
  });

  app.delete ("/api/tracks/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const track = await storage.getTrack(id);
    if (!track) return res.status(404).json({ message: "Not found" });
    const ap = await storage.getAnimaticProject(track.animaticProjectId);
    if (!ap || !canAccessProject(ap.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deleteTrack(id);
    res.json({ ok: true });
  });

  // ===== ANIMATIC CLIPS =====
  app.post ("/api/tracks/:id/clips", requireAuth, async (req, res) => {
    const trackId = parseInt(String(req.params.id), 10);
    const track = await storage.getTrack(trackId);
    if (!track) return res.status(404).json({ message: "Not found" });
    const ap = await storage.getAnimaticProject(track.animaticProjectId);
    if (!ap || !canAccessProject(ap.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      startMs: z.number().int().optional().default(0),
      durationMs: z.number().int().optional().default(2000),
      sourceKind: z.string().optional().default("panel_ref"),
      sourceId: z.number().int().nullable().optional(),
      audioDataUrl: z.string().nullable().optional(),
      label: z.string().optional().default(""),
      fadeInMs: z.number().int().optional().default(0),
      fadeOutMs: z.number().int().optional().default(0),
      volume: z.string().optional().default("1.0"),
    });
    const body = schema.parse(req.body);
    if (body.audioDataUrl && body.audioDataUrl.length > 14 * 1024 * 1024) {
      return res.status(413).json({ message: "Audio too large (max 10MB)" });
    }
    const clip = await storage.createClip({
      trackId,
      startMs: body.startMs,
      durationMs: body.durationMs,
      sourceKind: body.sourceKind,
      sourceId: body.sourceId ?? null,
      audioDataUrl: body.audioDataUrl ?? null,
      label: body.label,
      fadeInMs: body.fadeInMs,
      fadeOutMs: body.fadeOutMs,
      volume: body.volume,
    });
    res.json(clip);
  });

  app.patch ("/api/clips/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const clip = await storage.getClip(id);
    if (!clip) return res.status(404).json({ message: "Not found" });
    const track = await storage.getTrack(clip.trackId);
    if (!track) return res.status(404).json({ message: "Track not found" });
    const ap = await storage.getAnimaticProject(track.animaticProjectId);
    if (!ap || !canAccessProject(ap.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      startMs: z.number().int().optional(),
      durationMs: z.number().int().optional(),
      sourceKind: z.string().optional(),
      sourceId: z.number().int().nullable().optional(),
      audioDataUrl: z.string().nullable().optional(),
      label: z.string().optional(),
      fadeInMs: z.number().int().optional(),
      fadeOutMs: z.number().int().optional(),
      volume: z.string().optional(),
    });
    const patch = schema.parse(req.body);
    const updated = await storage.updateClip(id, patch as any);
    res.json(updated);
  });

  app.delete ("/api/clips/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const clip = await storage.getClip(id);
    if (!clip) return res.status(404).json({ message: "Not found" });
    const track = await storage.getTrack(clip.trackId);
    if (!track) return res.status(404).json({ message: "Track not found" });
    const ap = await storage.getAnimaticProject(track.animaticProjectId);
    if (!ap || !canAccessProject(ap.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deleteClip(id);
    res.json({ ok: true });
  });

  // ===== FREESOUND PROXY =====
  app.get("/api/freesound/search", requireAuth, async (req, res) => {
    const apiKey = process.env.FREESOUND_API_KEY || "FREESOUND_API_KEY_HERE";
    if (apiKey === "FREESOUND_API_KEY_HERE") {
      console.warn("[Cel] FREESOUND_API_KEY not set — sound effects search will not work. Get a free key at https://freesound.org/apiv2/apply/");
      return res.status(503).json({ message: "Freesound API key not configured. See server console.", results: { results: [] } });
    }
    const q = String(req.query.q || "");
    const page = parseInt(String(req.query.page || "1"), 10);
    try {
      const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(q)}&fields=id,name,previews,duration,username,license&page=${page}&page_size=15&token=${apiKey}`;
      const r = await fetch(url);
      if (!r.ok) {
        const txt = await r.text();
        return res.status(r.status).json({ message: txt });
      }
      const data = await r.json();
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ message: String(e.message || e) });
    }
  });

  app.get("/api/freesound/:soundId/preview", requireAuth, async (req, res) => {
    const apiKey = process.env.FREESOUND_API_KEY || "FREESOUND_API_KEY_HERE";
    if (apiKey === "FREESOUND_API_KEY_HERE") {
      return res.status(503).json({ message: "Freesound API key not configured." });
    }
    const soundId = parseInt(String(req.params.soundId), 10);
    try {
      const infoUrl = `https://freesound.org/apiv2/sounds/${soundId}/?fields=previews&token=${apiKey}`;
      const infoR = await fetch(infoUrl);
      if (!infoR.ok) return res.status(infoR.status).json({ message: "Sound not found" });
      const info = await infoR.json();
      const previews = info.previews || {};
      const previewUrl = previews["preview-lq-mp3"] || previews["preview-hq-mp3"];
      if (!previewUrl) return res.status(404).json({ message: "No preview available" });
      const audioR = await fetch(previewUrl);
      if (!audioR.ok) return res.status(audioR.status).end();
      res.setHeader("Content-Type", audioR.headers.get("content-type") || "audio/mpeg");
      const buf = await audioR.arrayBuffer();
      res.send(Buffer.from(buf));
    } catch (e: any) {
      res.status(500).json({ message: String(e.message || e) });
    }
  });

  // ===== PUBLIC SHARE =====
  app.get ("/api/share/:token", async (req, res) => {
    const token = req.params.token;
    const p = await storage.getProjectByToken(token);
    if (!p || !p.shareEnabled) return res.status(404).json({ message: "Share link not found or disabled" });
    const owner = await storage.getUser(p.ownerId);
    const scripts = await storage.listScripts(p.id);
    const storyboards = await storage.listStoryboards(p.id).map(async (sb) => ({
      ...sb, panels: await storage.listPanels(sb.id),
    }));
    const animatics = await storage.listAnimatics(p.id);
    const scenes = await storage.listScenes(p.id);
    res.json({
      project: { ...p, shareToken: undefined },
      owner: owner ? { name: owner.name, avatarColor: owner.avatarColor } : null,
      scripts, storyboards, animatics, scenes,
    });
  });

  // Public share meta endpoint (for watermark)
  app.get ("/api/share/:token/meta", async (req, res) => {
    const token = req.params.token;
    const p = await storage.getProjectByToken(token);
    if (!p || !p.shareEnabled) return res.status(404).json({ message: "Not found" });
    res.json({ status: p.status, title: p.title });
  });

  // Public share cli_approvals endpoint
  app.get ("/api/share/:token/cli_approvals", async (req, res) => {
    const token = req.params.token;
    const p = await storage.getProjectByToken(token);
    if (!p || !p.shareEnabled) return res.status(404).json({ message: "Not found" });
    const approvals = await storage.getCliApprovals(p.id);
    res.json(approvals);
  });

  // ===== v4 AI KEY MANAGEMENT =====
  // ===== v4 AI KEY MANAGEMENT =====
  app.get("/api/projects/:id/ai/key", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const row = await storage.getProjectAiKey(id);
    res.json({ hasKey: !!row, model: row?.model || null });
  });

  app.post("/api/projects/:id/ai/key", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({ key: z.string().min(1), model: z.string().optional() });
    const body = schema.parse(req.body);
    await storage.setProjectAiKey(id, obfuscateKey(body.key), body.model);
    res.json({ ok: true });
  });

  app.delete("/api/projects/:id/ai/key", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deleteProjectAiKey(id);
    res.json({ ok: true });
  });

  app.post("/api/projects/:id/ai/shot-suggest", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({ scriptText: z.string().min(1) });
    let body: { scriptText: string };
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }

    const keyRow = await storage.getProjectAiKey(id);
    if (!keyRow) return res.status(400).json({ message: "No AI key set for this project" });
    const apiKey = deobfuscateKey(keyRow.encryptedKey);

    const models = keyRow.model ? [keyRow.model] : ["meta-llama/llama-3.2-3b-instruct:free", "google/gemma-2-9b-it:free"];
    const systemPrompt = `You are a storyboard artist's assistant. Given a script passage, suggest 4-8 shots. For each, give: shot number, shot type (wide/medium/close/insert/OTS/etc.), camera move, action description (1-2 sentences). Return as JSON array with fields: shotNumber, shotType, cameraMove, actionDescription.`;

    let lastErr = "";
    for (const model of models) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://cel.app",
            "X-Title": "Cel Storyboard App",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: body.scriptText },
            ],
          }),
        });
        const data = await response.json() as any;
        if (!response.ok) { lastErr = data?.error?.message || JSON.stringify(data); continue; }
        const content = data.choices?.[0]?.message?.content || "";
        // Extract JSON array from content
        const match = content.match(/\[[\s\S]*\]/);
        if (!match) return res.json({ shots: [], raw: content });
        const shots = JSON.parse(match[0]);
        return res.json({ shots });
      } catch (e: any) {
        lastErr = e.message;
      }
    }
    return res.status(500).json({ message: `OpenRouter error: ${lastErr}` });
  });

  // ===== v4 AI Agent Chat =====
  app.get("/api/projects/:id/ai/sessions", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const sessions = await storage.listAiChatSessions(id);
    res.json(sessions);
  });

  app.post("/api/projects/:id/ai/sessions", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({ title: z.string().optional(), scriptId: z.number().optional() });
    const body = schema.parse(req.body);
    const session = await storage.createAiChatSession({ projectId: id, ...body });
    res.json(session);
  });

  app.delete("/api/projects/:id/ai/sessions/:sessionId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    await storage.deleteAiChatSession(parseInt(req.params.sessionId));
    res.json({ ok: true });
  });

  app.get("/api/projects/:id/ai/sessions/:sessionId/messages", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const messages = await storage.listAiChatMessages(parseInt(req.params.sessionId));
    res.json(messages);
  });

  app.post("/api/projects/:id/ai/chat", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    
    const schema = z.object({
      sessionId: z.number(),
      content: z.string(),
      scriptContent: z.string(), // Provide current script context
    });
    let body;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }

    const keyRow = await storage.getProjectAiKey(id);
    if (!keyRow) return res.status(400).json({ message: "No AI key set for this project" });
    const apiKey = deobfuscateKey(keyRow.encryptedKey);
    // Use user's preferred model or fallback to Gemma 2 9B (which supports tools well)
    const models = keyRow.model ? [keyRow.model] : ["google/gemma-2-9b-it:free"];

    const project = await storage.getProject(id);
    const systemPrompt = `You are Cel Assistant, an agentic AI helper for an animation studio.
Current Date: ${new Date().toLocaleString()}
Project: ${project?.title} - ${project?.description || ""}

You have access to tools that can edit the current script directly. When a user asks you to rewrite, fix, or modify something, USE the \`edit_script_passage\` tool. DO NOT just output the rewritten text in your message, actually call the tool so it applies to the UI.

<Current_Script_Context>
${body.scriptContent}
</Current_Script_Context>`;

    await storage.createAiChatMessage({
      sessionId: body.sessionId,
      role: "user",
      content: body.content
    });

    const messages = await storage.listAiChatMessages(body.sessionId).map((m: any) => {
      const msg: any = { role: m.role, content: m.content };
      if (m.toolCalls) msg.tool_calls = JSON.parse(m.toolCalls);
      if (m.toolCallId) msg.tool_call_id = m.toolCallId;
      return msg;
    });

    const openRouterPayload = {
      model: models[0],
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
      tools: [
        {
          type: "function",
          function: {
            name: "edit_script_passage",
            description: "Rewrite or modify a specific passage or sentence in the current script.",
            parameters: {
              type: "object",
              properties: {
                original_text: { type: "string" },
                replacement_text: { type: "string" },
                explanation: { type: "string" }
              },
              required: ["original_text", "replacement_text"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "suggest_shots",
            description: "Suggest a sequence of camera shots for a given scene description.",
            parameters: {
              type: "object",
              properties: {
                scene_description: { type: "string" },
                shots: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      shotNumber: { type: "number" },
                      shotType: { type: "string" },
                      cameraMove: { type: "string" },
                      actionDescription: { type: "string" }
                    }
                  }
                }
              },
              required: ["shots"]
            }
          }
        }
      ]
    };

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://cel.app",
          "X-Title": "Cel Assistant",
        },
        body: JSON.stringify(openRouterPayload),
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(500).json({ message: `OpenRouter Error: ${err}` });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      let fullContent = "";
      let toolCalls: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n").filter(l => l.trim().startsWith("data: "));

        for (const line of lines) {
          const dataText = line.substring(6);
          if (dataText === "[DONE]") {
            const saved = await storage.createAiChatMessage({
              sessionId: body.sessionId,
              role: "assistant",
              content: fullContent,
              toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
              createdAt: new Date().toISOString()
            });
            res.write(`data: ${JSON.stringify({ done: true, message: saved })}\n\n`);
            res.end();
            return;
          }

          try {
            const data = JSON.parse(dataText);
            const delta = data.choices[0].delta;
            if (delta.content) {
              fullContent += delta.content;
              res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const i = tc.index;
                if (!toolCalls[i]) toolCalls[i] = { id: tc.id, type: "function", function: { name: "", arguments: "" } };
                if (tc.id) toolCalls[i].id = tc.id;
                if (tc.function?.name) toolCalls[i].function.name += tc.function.name;
                if (tc.function?.arguments) toolCalls[i].function.arguments += tc.function.arguments;
              }
            }
          } catch (e) {}
        }
      }
    } catch (e: any) {
      return res.status(500).json({ message: `Agent error: ${e.message}` });
    }
  });

  app.post("/api/projects/:projectId/ai/agent/check", requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.projectId, 10);
    const { scriptContent, lastVersion } = req.body;

    const apiKey = await storage.getProjectAiKey(projectId);
    if (!apiKey) return res.status(404).json({ message: "No API key configured" });

    const prompt = `You are the Cel Assistant. The user has just finished a draft of their script. 
    Analyze the changes between the last version and this version (if provided), or just summarize the current script.
    Suggest any immediate improvements or shots that come to mind. 
    Keep it concise (2-3 sentences max).
    
    Current Script:
    ${scriptContent}
    
    Last Version (Partial/Full):
    ${lastVersion || "N/A"}`;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey.encryptedKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: apiKey.model || "openai/gpt-4o-mini",
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || "No feedback at this time.";
      
      res.json({ feedback: content });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== v4 ACHIEVEMENTS =====
  app.get("/api/achievements", requireAuth, async (req, res) => {
    const { ACHIEVEMENT_DEFS } = require("./achievements");
    const unlocked: any[] = await (storage as any).listAchievements(req.user!.id);
    const result = ACHIEVEMENT_DEFS.map((def: any) => {
      const row = unlocked.find((u: any) => u.code === def.code);
      return { ...def, unlockedAt: row?.unlockedAt || null, locked: !row };
    });
    res.json(result);
  });

  // ===== v4 PANEL PINS =====
  app.get ("/api/panels/:id/pins", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const panel = await storage.getPanel(id);
    if (!panel) return res.status(404).json({ message: "Panel not found" });
    const sb = await storage.getStoryboard(panel.storyboardId);
    if (!sb || !canAccessProject(sb.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const pins = await (storage as any).listPanelPins(id);
    const enriched = pins.map(async (p: any) => async ({
      ...p,
      author: (async () => { const u = await storage.getUser(p.authorId); return u ? { id: u.id, name: u.name, avatarColor: u.avatarColor } : null; })(),
    }));
    res.json(enriched);
  });

  app.post ("/api/panels/:id/pins", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const panel = await storage.getPanel(id);
    if (!panel) return res.status(404).json({ message: "Panel not found" });
    const sb = await storage.getStoryboard(panel.storyboardId);
    if (!sb || !canAccessProject(sb.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      xPercent: z.number().min(0).max(100),
      yPercent: z.number().min(0).max(100),
      body: z.string().min(1),
    });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const pin = await (storage as any).createPanelPin({ panelId: id, ...body, authorId: req.user!.id });
    res.json(pin);
  });

  app.delete ("/api/pins/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const pin = await (storage as any).getPanelPin(id);
    if (!pin) return res.status(404).json({ message: "Not found" });
    const panel = await storage.getPanel(pin.panelId);
    if (!panel) return res.status(404).json({ message: "Panel not found" });
    const sb = await storage.getStoryboard(panel.storyboardId);
    if (!sb || !canAccessProject(sb.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    await (storage as any).deletePanelPin(id);
    res.json({ ok: true });
  });

  // Public share pins
  app.get ("/api/share/:token/panels/:panelId/pins", async (req, res) => {
    const token = req.params.token;
    const panelId = parseInt(String(req.params.panelId), 10);
    const p = await storage.getProjectByToken(token);
    if (!p || !p.shareEnabled) return res.status(404).json({ message: "Not found" });
    const panel = await storage.getPanel(panelId);
    if (!panel) return res.status(404).json({ message: "Panel not found" });
    res.json(await (storage as any).listPanelPins(panelId));
  });

  // ===== v4 COMMISSION LINE ITEMS =====
  app.get ("/api/commissions/:id/line-items", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const c = await storage.getCommission(id);
    if (!c) return res.status(404).json({ message: "Not found" });
    if (c.ownerUserId !== req.user!.id) return res.status(403).json({ message: "No access" });
    res.json(await (storage as any).listCommissionLineItems(id));
  });

  app.post ("/api/commissions/:id/line-items", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const c = await storage.getCommission(id);
    if (!c) return res.status(404).json({ message: "Not found" });
    if (c.ownerUserId !== req.user!.id) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      description: z.string().min(1),
      quantity: z.number().int().min(1).optional().default(1),
      unitPriceCents: z.number().int().min(0),
    });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    res.json(await (storage as any).createCommissionLineItem({ commissionId: id, ...body }));
  });

  app.patch ("/api/commission-line-items/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const lineItem = await (storage as any).getCommissionLineItem(id);
    if (!lineItem) return res.status(404).json({ message: "Not found" });
    const c = await storage.getCommission(lineItem.commissionId);
    if (!c || c.ownerUserId !== req.user!.id) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      description: z.string().min(1).optional(),
      quantity: z.number().int().min(1).optional(),
      unitPriceCents: z.number().int().min(0).optional(),
    });
    let patch: any;
    try { patch = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    res.json(await (storage as any).updateCommissionLineItem(id, patch));
  });

  app.delete ("/api/commission-line-items/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const lineItem = await (storage as any).getCommissionLineItem(id);
    if (!lineItem) return res.status(404).json({ message: "Not found" });
    const c = await storage.getCommission(lineItem.commissionId);
    if (!c || c.ownerUserId !== req.user!.id) return res.status(403).json({ message: "No access" });
    await (storage as any).deleteCommissionLineItem(id);
    res.json({ ok: true });
  });

  app.patch ("/api/commissions/:id/quote", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const c = await storage.getCommission(id);
    if (!c) return res.status(404).json({ message: "Not found" });
    if (c.ownerUserId !== req.user!.id) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      quoteCents: z.number().int().min(0).nullable().optional(),
      invoicedAt: z.string().nullable().optional(),
    });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    await (storage as any).updateCommissionQuote(id, body.quoteCents, body.invoicedAt);
    res.json(await storage.getCommission(id));
  });

  // ===== v4 COMMISSION PRICING PRESETS =====
  app.get("/api/projects/:id/pricing-presets", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    res.json(await (storage as any).listCommissionPricingPresets(id));
  });

  app.post("/api/projects/:id/pricing-presets", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!canAccessProject(id, req.user!.id)) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      kind: z.enum(["package", "addon"]).optional().default("package"),
      name: z.string().min(1),
      description: z.string().optional().default(""),
      priceCents: z.number().int().min(0),
    });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    res.json(await (storage as any).createCommissionPricingPreset({ projectId: id, ...body }));
  });

  app.delete ("/api/pricing-presets/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const preset = await (storage as any).getCommissionPricingPreset(id);
    if (!preset) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(preset.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    await (storage as any).deleteCommissionPricingPreset(id);
    res.json({ ok: true });
  });

  // ===== v4 INBOX =====
  app.get ("/api/inbox", requireAuth, async (req, res) => {
    res.json(await (storage as any).listInboxItems(req.user!.id));
  });

  app.post("/api/inbox", requireAuth, async (req, res) => {
    const schema = z.object({
      body: z.string().min(1),
      tags: z.string().optional().default(""),
      projectId: z.number().int().nullable().optional(),
    });
    let item: any;
    try { item = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    res.json(await (storage as any).createInboxItem({ userId: req.user!.id, ...item }));
  });

  app.patch ("/api/inbox/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const item = await (storage as any).getInboxItem(id);
    if (!item || item.userId !== req.user!.id) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      body: z.string().min(1).optional(),
      tags: z.string().optional(),
      projectId: z.number().int().nullable().optional(),
    });
    let patch: any;
    try { patch = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    res.json(await (storage as any).updateInboxItem(id, patch));
  });

  app.delete ("/api/inbox/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const item = await (storage as any).getInboxItem(id);
    if (!item || item.userId !== req.user!.id) return res.status(403).json({ message: "No access" });
    await (storage as any).deleteInboxItem(id);
    res.json({ ok: true });
  });

  // ===== v4 TAGS =====
  app.get ("/api/tags", requireAuth, async (req, res) => {
    res.json(await (storage as any).listTags(req.user!.id));
  });

  app.post("/api/tags", requireAuth, async (req, res) => {
    const schema = z.object({ name: z.string().min(1), color: z.string().optional().default("#6E4FE8") });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    res.json(await (storage as any).createTag({ userId: req.user!.id, ...body }));
  });

  app.patch ("/api/tags/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const tag = await (storage as any).getTag(id);
    if (!tag) return res.status(404).json({ message: "Not found" });
    if (tag.userId !== req.user!.id) return res.status(403).json({ message: "No access" });
    const schema = z.object({ name: z.string().min(1).optional(), color: z.string().optional() });
    let patch: any;
    try { patch = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    res.json(await (storage as any).updateTag(id, patch));
  });

  app.delete ("/api/tags/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const tag = await (storage as any).getTag(id);
    if (!tag) return res.status(404).json({ message: "Not found" });
    if (tag.userId !== req.user!.id) return res.status(403).json({ message: "No access" });
    await (storage as any).deleteTag(id);
    res.json({ ok: true });
  });

  app.get("/api/tag-assignments", requireAuth, async (req, res) => {
    const { kind, entityId } = req.query as { kind: string; entityId: string };
    if (!kind || !entityId) return res.status(400).json({ message: "kind and entityId required" });
    res.json(await (storage as any).listTagAssignments(kind, parseInt(entityId, 10)));
  });

  app.post("/api/tag-assignments", requireAuth, async (req, res) => {
    const schema = z.object({
      tagId: z.number().int(),
      entityKind: z.enum(["scene", "asset", "panel", "inboxItem"]),
      entityId: z.number().int(),
    });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const tag = await (storage as any).getTag(body.tagId);
    if (!tag || tag.userId !== req.user!.id) return res.status(403).json({ message: "No access" });
    res.json(await (storage as any).createTagAssignment(body));
  });

  app.delete ("/api/tag-assignments/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const assignment = await (storage as any).getTagAssignment(id);
    if (!assignment) return res.status(404).json({ message: "Not found" });
    const tag = await (storage as any).getTag(assignment.tagId);
    if (!tag || tag.userId !== req.user!.id) return res.status(403).json({ message: "No access" });
    await (storage as any).deleteTagAssignment(id);
    res.json({ ok: true });
  });

  // ===== v4 SCENE TIMER =====
  app.get ("/api/scenes/:id/time", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const scene = await storage.getScene(id);
    if (!scene) return res.status(404).json({ message: "Scene not found" });
    if (!canAccessProject(scene.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const entries = await (storage as any).listSceneTimeEntries(id);
    const totalMs = entries.filter((e: any) => e.durationMs).reduce((sum: number, e: any) => sum + e.durationMs, 0);
    const active = entries.find((e: any) => !e.endedAt);
    res.json({ entries, totalMs, active: active || null });
  });

  app.post ("/api/scenes/:id/timer/start", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const scene = await storage.getScene(id);
    if (!scene) return res.status(404).json({ message: "Scene not found" });
    if (!canAccessProject(scene.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    // Stop any already-running timer first
    const existing = await (storage as any).getActiveTimeEntry(id, req.user!.id);
    if (existing) {
      await (storage as any).stopTimer(existing.id);
    }
    const entry = await (storage as any).startTimer(id, req.user!.id);
    res.json(entry);
  });

  app.post ("/api/scenes/:id/timer/stop", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const scene = await storage.getScene(id);
    if (!scene) return res.status(404).json({ message: "Scene not found" });
    if (!canAccessProject(scene.projectId, req.user!.id)) return res.status(403).json({ message: "No access" });
    const active = await (storage as any).getActiveTimeEntry(id, req.user!.id);
    if (!active) return res.status(404).json({ message: "No active timer" });
    const entry = await (storage as any).stopTimer(active.id);
    res.json(entry);
  });

  // ===== v4 GLOBAL SEARCH =====
  app.get("/api/search", requireAuth, async (req, res) => {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(parseInt(String(req.query.limit || "20"), 10), 50);
    if (!q || q.length < 1) return res.json({ projects: [], scenes: [], scripts: [], assets: [], comments: [] });
    try {
      const results = await (storage as any).globalSearch(req.user!.id, q, limit);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/aud/voice_takes", requireAuth, async (req, res) => {
    try {
      const data = insertAudVoiceTakeSchema.parse(req.body);
      if (data.projectId && !canAccessProject(data.projectId, req.user!.id)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const take = await (storage as any).createAudVoiceTake(data);
      res.json(take);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/projects/:id/aud/voice_takes", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.id));
      if (!canAccessProject(projectId, req.user!.id)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const takes = await (storage as any).getAudVoiceTakesByProject(projectId);
      res.json(takes);
    } catch(e:any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post ("/api/animatics/:id/aud/captions", requireAuth, async (req, res) => {
    try {
      const animaticProjectId = parseInt(String(req.params.id));
      const ap = await storage.getAnimaticProject(animaticProjectId);
      if (!ap || !canAccessProject(ap.projectId, req.user!.id)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const data = insertAudCaptionSchema.parse({ ...req.body, animaticProjectId });
      const caption = await (storage as any).createAudCaption(data);
      res.json(caption);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get ("/api/animatics/:id/aud/captions", requireAuth, async (req, res) => {
    try {
      const animaticProjectId = parseInt(String(req.params.id));
      const ap = await storage.getAnimaticProject(animaticProjectId);
      if (!ap || !canAccessProject(ap.projectId, req.user!.id)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const captions = await (storage as any).getAudCaptionsByAnimatic(animaticProjectId);
      res.json(captions);
    } catch(e:any) {
      res.status(400).json({ error: e.message });
    }
  });
  
  app.delete ("/api/aud/captions/:id", requireAuth, async (req, res) => {
    try {
       const id = parseInt(String(req.params.id));
       const caption = await (storage as any).getAudCaption(id);
       if (caption) {
         const ap = await storage.getAnimaticProject(caption.animaticProjectId);
         if (!ap || !canAccessProject(ap.projectId, req.user!.id)) {
           return res.status(403).json({ message: "Forbidden" });
         }
       }
       await (storage as any).deleteAudCaption(id);
       res.json({ success: true });
    } catch (e: any) {
       res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/analytics/commission-hours", requireAuth, async (req, res) => {
    try {
      // Scope to user's own commissions via join
      const hours = db
        .select({
          commissionId: dltCommissionHours.commissionId,
          hours: dltCommissionHours.hours,
        })
        .from(dltCommissionHours)
        .innerJoin(commissions, eq(dltCommissionHours.commissionId, commissions.id))
        .where(eq(commissions.ownerUserId, req.user!.id))
        .all();

      const hoursMap: Record<number, number> = {};
      for (const h of hours) {
        hoursMap[h.commissionId] = (hoursMap[h.commissionId] || 0) + h.hours;
      }

      res.json(hoursMap);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post ("/api/commissions/:id/hours", requireAuth, async (req, res) => {
    try {
      const commissionId = parseInt(String(req.params.id), 10);
      const c = await storage.getCommission(commissionId);
      if (!c) return res.status(404).json({ error: "Commission not found" });
      if (c.ownerUserId !== req.user!.id) return res.status(403).json({ error: "No access" });
      const { hours } = req.body;
      const parsedHours = parseFloat(hours);
      
      if (isNaN(parsedHours) || parsedHours <= 0) {
        return res.status(400).json({ error: "Invalid hours" });
      }
      
      const record = await (storage as any).addCommissionHours({ commissionId, hours: parsedHours });
      res.json(record);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/analytics/heatmap", requireAuth, async (req, res) => {
    try {
      // Gather scene time entries scoped to the current user's projects
      const entries = db.select({
        sceneId: scenes.id,
        sceneName: scenes.title,
        startedAt: sceneTimeEntries.startedAt,
        durationMs: sceneTimeEntries.durationMs,
      })
      .from(sceneTimeEntries)
      .innerJoin(scenes, eq(sceneTimeEntries.sceneId, scenes.id))
      .innerJoin(projects, eq(scenes.projectId, projects.id))
      .where(eq(projects.ownerId, req.user!.id))
      .all();
      
      // Group by scene, then by day
      // format: [ { sceneId, sceneName, days: { "2024-05-13": 120, ... } } ]
      const sceneMap = new Map();
      
      for (const e of entries) {
        if (!e.durationMs) continue; // skip unstopped timers
        
        if (!sceneMap.has(e.sceneId)) {
          sceneMap.set(e.sceneId, { sceneId: e.sceneId, sceneName: e.sceneName, days: {} });
        }
        
        const sceneData = sceneMap.get(e.sceneId);
        
        // Convert timestamp to YYYY-MM-DD
        const dateObj = new Date(e.startedAt);
        const dayKey = dateObj.toISOString().split('T')[0];
        
        // Convert ms to minutes
        const mins = e.durationMs / 60000;
        
        sceneData.days[dayKey] = (sceneData.days[dayKey] || 0) + mins;
      }
      
      res.json(Array.from(sceneMap.values()));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/analytics/task-hours", requireAuth, async (req, res) => {
    try {
      const sceneRows = db.select({
        sceneId: scenes.id,
        sceneNumber: scenes.number,
        sceneName: scenes.title,
        sceneDescription: scenes.description,
        status: scenes.status,
        projectName: projects.title,
      })
        .from(scenes)
        .innerJoin(projects, eq(scenes.projectId, projects.id))
        .where(eq(projects.ownerId, req.user!.id))
        .all();

      const entries = db.select({
        sceneId: scenes.id,
        startedAt: sceneTimeEntries.startedAt,
        durationMs: sceneTimeEntries.durationMs,
      })
        .from(sceneTimeEntries)
        .innerJoin(scenes, eq(sceneTimeEntries.sceneId, scenes.id))
        .innerJoin(projects, eq(scenes.projectId, projects.id))
        .where(eq(projects.ownerId, req.user!.id))
        .all();

      const entryMap = new Map<number, { totalMs: number; sessions: number; lastTrackedAt: number | null }>();
      for (const entry of entries) {
        if (!entry.durationMs) continue;
        const current = entryMap.get(entry.sceneId) ?? { totalMs: 0, sessions: 0, lastTrackedAt: null };
        current.totalMs += entry.durationMs;
        current.sessions += 1;
        current.lastTrackedAt = Math.max(current.lastTrackedAt ?? 0, entry.startedAt);
        entryMap.set(entry.sceneId, current);
      }

      const rows = sceneRows.map((scene) => {
        const tracked = entryMap.get(scene.sceneId) ?? { totalMs: 0, sessions: 0, lastTrackedAt: null };
        const frameMatch = `${scene.sceneName} ${scene.sceneDescription}`.match(/\b(\d{2,5})\s*(?:frames?|fr)\b/i);
        const estimatedFrames = frameMatch ? Math.max(1, parseInt(frameMatch[1], 10)) : 144;
        const totalMinutes = tracked.totalMs / 60_000;
        return {
          ...scene,
          totalMs: tracked.totalMs,
          sessions: tracked.sessions,
          lastTrackedAt: tracked.lastTrackedAt ? new Date(tracked.lastTrackedAt).toISOString() : null,
          estimatedFrames,
          minutesPerFrame: estimatedFrames > 0 ? totalMinutes / estimatedFrames : 0,
        };
      });

      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post ("/api/projects/:id/discord/test", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.id), 10);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      
      const webhookUrl = (project as any).dltDiscordWebhookUrl;
      if (!webhookUrl) return res.status(400).json({ error: "No webhook configured" });
      
      // Send webhook via fetch to discord
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: `Cel Notification Test: ${project.title}`,
            description: "Discord webhook integration is working correctly!",
            color: 0x9DD0FF,
            timestamp: new Date().toISOString()
          }]
        })
      }).then(r => {
        if (!r.ok) {
          console.error("Discord webhook failed:", r.statusText);
        }
      }).catch(err => {
        console.error("Discord webhook fetch failed:", err);
      });
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===== CLI APPROVALS / FEEDBACK (token or auth) =====
  app.get ("/api/projects/:id/cli_approvals", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id, 10);
      const token = req.query.token as string | undefined;
      if (token) {
        const project = await storage.getProjectByToken(token);
        if (!project || project.id !== projectId || !project.shareEnabled) {
          return res.status(403).json({ message: "No access" });
        }
      } else {
        const authToken = req.headers.authorization?.split(" ")[1];
        const userId = getSessionUser(authToken);
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        if (!canAccessProject(projectId, userId)) return res.status(403).json({ message: "No access" });
      }
      const approvals = await (storage as any).getCliApprovals(projectId);
      res.json(approvals);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post ("/api/projects/:id/cli_approvals", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id, 10);
      const token = req.query.token as string | undefined;
      if (token) {
        const project = await storage.getProjectByToken(token);
        if (!project || project.id !== projectId || !project.shareEnabled) {
          return res.status(403).json({ message: "No access" });
        }
      } else {
        const authToken = req.headers.authorization?.split(" ")[1];
        const userId = getSessionUser(authToken);
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        if (!canAccessProject(projectId, userId)) return res.status(403).json({ message: "No access" });
      }
      const { phase, signedName, signatureData, signedAt } = req.body;
      const approval = await (storage as any).createCliApproval({ projectId, phase, signedName, signatureData, signedAt });
      res.json(approval);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get ("/api/projects/:id/cli_feedback", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id, 10);
      const token = req.query.token as string | undefined;
      if (token) {
        const project = await storage.getProjectByToken(token);
        if (!project || project.id !== projectId || !project.shareEnabled) {
          return res.status(403).json({ message: "No access" });
        }
      } else {
        const authToken = req.headers.authorization?.split(" ")[1];
        const userId = getSessionUser(authToken);
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        if (!canAccessProject(projectId, userId)) return res.status(403).json({ message: "No access" });
      }
      const feedback = await (storage as any).getCliFeedback(projectId);
      res.json(feedback);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post ("/api/projects/:id/cli_feedback", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id, 10);
      const token = req.query.token as string | undefined;
      if (token) {
        const project = await storage.getProjectByToken(token);
        if (!project || project.id !== projectId || !project.shareEnabled) {
          return res.status(403).json({ message: "No access" });
        }
      } else {
        const authToken = req.headers.authorization?.split(" ")[1];
        const userId = getSessionUser(authToken);
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        if (!canAccessProject(projectId, userId)) return res.status(403).json({ message: "No access" });
      }
      const { sceneId, fields } = req.body;
      const feedback = await (storage as any).createCliFeedback({ projectId, sceneId, fields });
      res.json(feedback);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return httpServer;
}

// Helper: simple base64 obfuscation (NOT real encryption — for note-keeping only)
function obfuscateKey(key: string): string {
  return Buffer.from(key).toString("base64");
}
function deobfuscateKey(key: string): string {
  try { return Buffer.from(key, "base64").toString("utf8"); } catch { return ""; }
}
