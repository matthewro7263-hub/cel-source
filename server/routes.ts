import multer from "multer";
import { randomUUID } from "node:crypto";
import type { Express, Request, Response, NextFunction } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import {
  storage, db, hashPassword, verifyPassword, createSession,
  getSessionPayload, destroySession, genToken,
} from "./storage";
import { presignDownload, putObject } from "./r2";
import { notifyDiscord } from "./discord";
import { sendError } from "./errors";
import { encrypt, decrypt } from "./crypto";
import { authenticateToken, extractToken, requireAuth, canAccessProject, invalidateProjectAccess } from "./auth";
import { checkAchievements } from "./achievements";

function fireAchievements(ctx: Parameters<typeof checkAchievements>[0]) {
  checkAchievements(ctx).catch((err) => console.error("[achievements]", err));
}
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
import { bakRouter } from "./routes/bak/index.js";
import { registerStudioRoutes } from "./studio_routes";
import { registerA11yRoutes } from "./a11y_routes";
import { registerChallengeRoutes } from "./challenge_routes";
import { registerReviewRoom, registerReviewRoomTicketRoute } from "./review_room";
import { registerMcpRoutes } from "./mcp_routes";
import { registerBizRoutes } from "./biz_routes";
import { uploadsRouter } from "./uploads_routes";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

  registerReviewRoom(httpServer);
  registerReviewRoomTicketRoute(app);
  registerMcpRoutes(app);

  app.use("/api", bakRouter);
  app.use("/api/uploads", requireAuth, uploadsRouter);

  registerBizRoutes(app);

  registerStudioRoutes(app);

  registerA11yRoutes(app);
  registerChallengeRoutes(app);

  // No cookie-parser — we use Authorization: Bearer <token> only

  // ===== RATE LIMITERS (separate bucket per limiter) =====
  const limiter = (windowMs: number, max: number, message: string) =>
    rateLimit({
      windowMs,
      limit: max,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => res.status(429).json({ message }),
    });

  const signupLimiter = limiter(60 * 60 * 1000, 10, "Too many registrations from this IP, please try again in an hour.");
  const loginLimiter = limiter(15 * 60 * 1000, 20, "Too many login attempts, please try again in 15 minutes.");
  const commissionLimiter = limiter(60 * 60 * 1000, 5, "Too many submissions. Try again later.");

  // ===== AUTH =====
  app.post("/api/auth/signup", signupLimiter, async (req, res) => {
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
      passwordHash: await hashPassword(body.password),
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
    });
    const token = createSession(user.id, user.tokenVersion);
    const { passwordHash, ...safe } = user;
    res.json({ user: safe, token });
  });

  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    const schema = z.object({ email: z.string().email(), password: z.string() });
    const body = schema.parse(req.body);
    const user = await storage.getUserByEmail(body.email);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = createSession(user.id, user.tokenVersion);
    const { passwordHash, ...safe } = user;
    res.json({ user: safe, token });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = extractToken(req);
    if (token) destroySession(token);
    res.json({ ok: true });
  });

  // Tokens are stateless, so "logout everywhere" revokes them by bumping tokenVersion.
  app.post("/api/auth/logout-all", requireAuth, async (req, res) => {
    await storage.updateUser(req.user!.id, { tokenVersion: req.user!.tokenVersion + 1 });
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const { passwordHash, ...safe } = req.user!;
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

  app.get ("/api/production/queue", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userProjects = await storage.listProjectsForUser(userId);
      const projectIds = userProjects.map((p: any) => p.id);
      const projectTitleById = new Map(userProjects.map((p: any) => [p.id, p.title]));

      const [allScenes, allStoryboards, allComments, allAssets] = await Promise.all([
        storage.listScenesForProjectIds(projectIds),
        storage.listStoryboardsForProjectIds(projectIds),
        storage.listCommentsForProjectIds(projectIds),
        storage.listAssetsForProjectIds(projectIds),
      ]);
      const allPanels = await storage.listPanelsLiteBatch(allStoryboards.map((sb: any) => sb.id));

      const activityUserIds = Array.from(new Set([
        ...allComments.map((c: any) => c.authorId),
        ...allAssets.map((a: any) => a.uploaderId),
      ]));
      const activityUsers = await storage.getUsersByIds(activityUserIds);
      const userCache = new Map<number, { name: string; avatarColor: string }>(
        activityUsers.map((u) => [u.id, { name: u.name, avatarColor: u.avatarColor }]),
      );
      const getUserInfo = (id: number) => userCache.get(id) ?? { name: "System", avatarColor: "#6E4FE8" };

      const scenesByProject = new Map<number, any[]>();
      for (const scene of allScenes) {
        const list = scenesByProject.get(scene.projectId) ?? [];
        list.push(scene);
        scenesByProject.set(scene.projectId, list);
      }

      const storyboardsByProject = new Map<number, any[]>();
      for (const sb of allStoryboards) {
        const list = storyboardsByProject.get(sb.projectId) ?? [];
        list.push(sb);
        storyboardsByProject.set(sb.projectId, list);
      }

      const panelsByStoryboard = new Map<number, any[]>();
      for (const panel of allPanels) {
        const list = panelsByStoryboard.get(panel.storyboardId) ?? [];
        list.push(panel);
        panelsByStoryboard.set(panel.storyboardId, list);
      }

      const queueItems = userProjects.map((project: any) => {
        const projectScenes = scenesByProject.get(project.id) ?? [];
        const activeScenes = projectScenes.filter((s: any) => s.status !== "done" && !s.deletedAt);
        const currentScene = activeScenes[0] || null;

        const projectStoryboards = storyboardsByProject.get(project.id) ?? [];
        const projectPanels: any[] = [];
        for (const sb of projectStoryboards) {
          projectPanels.push(...(panelsByStoryboard.get(sb.id) ?? []).filter((p: any) => !p.deletedAt));
        }

        let lastPanel: any = null;
        if (projectPanels.length > 0) {
          projectPanels.sort((a, b) => b.id - a.id);
          lastPanel = projectPanels[0];
        }

        const pendingScenesCount = activeScenes.length;
        const pendingChangeRequestsCount = projectPanels.filter((p) => p.changeRequest && p.changeRequest.trim() !== "").length;
        const pendingItemsCount = pendingScenesCount + pendingChangeRequestsCount;

        return {
          project: {
            id: project.id,
            title: project.title,
            status: project.status,
            coverColor: project.coverColor,
            deadline: project.deadline
          },
          currentScene: currentScene ? {
            id: currentScene.id,
            number: currentScene.number,
            title: currentScene.title,
            status: currentScene.status,
            deadline: currentScene.deadline
          } : null,
          lastPanel: lastPanel ? {
            id: lastPanel.id,
            storyboardId: lastPanel.storyboardId,
            orderIdx: lastPanel.orderIdx,
            r2Key: lastPanel.r2Key,
            caption: lastPanel.caption,
            dialogue: lastPanel.dialogue,
          } : null,
          pendingItemsCount,
        };
      });

      const activityFeed: any[] = [];
      for (const c of allComments) {
        const user = await getUserInfo(c.authorId);
        activityFeed.push({
          id: `comment-${c.id}`,
          projectId: c.projectId,
          projectTitle: projectTitleById.get(c.projectId) ?? "Project",
          type: "comment",
          user,
          content: c.body,
          timestamp: c.createdAt,
        });
      }
      for (const a of allAssets) {
        const user = await getUserInfo(a.uploaderId);
        activityFeed.push({
          id: `asset-${a.id}`,
          projectId: a.projectId,
          projectTitle: projectTitleById.get(a.projectId) ?? "Project",
          type: "asset",
          user,
          content: `Uploaded asset: ${a.filename} (${a.category})`,
          timestamp: a.createdAt,
        });
      }

      activityFeed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const recentActivity = activityFeed.slice(0, 20);

      res.json({
        queueItems,
        recentActivity
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
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
    fireAchievements({ userId: req.user!.id, event: "create_project", projectId: p.id });
    res.json(p);
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const p = await storage.getProject(id);
    const members = (await storage.listMembers(id)).map((m: any) => ({
      ...m,
      user: m.user ? { id: m.user.id, name: m.user.name, email: m.user.email, avatarColor: m.user.avatarColor } : null,
    }));
    res.json({ project: p, members });
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
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
    const before = await storage.getProject(id);
    const updated = await storage.updateProject(id, patch as any);
    if (patch.shareEnabled === true && !before?.shareEnabled) {
      fireAchievements({ userId: req.user!.id, event: "enable_share_link", projectId: id });
    }
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
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
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
        passwordHash: await hashPassword(tempPassword),
        avatarColor: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    if (!(await storage.isMember(id, user.id))) {
      await storage.addMember({ projectId: id, userId: user.id, role: body.role || "editor" });
      invalidateProjectAccess(id, user.id);
      fireAchievements({ userId: req.user!.id, event: "add_member", projectId: id });
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor }, tempPassword });
  });

  app.delete("/api/projects/:id/members/:userId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = parseInt(String(req.params.userId), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.removeMember(id, userId);
    invalidateProjectAccess(id, userId);
    res.json({ ok: true });
  });

  // Project-scoped R2 media (presigned URL for panels/assets in this project)
  app.get("/api/projects/:id/media", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const key = String(req.query.key ?? "");
    if (!key) return res.status(400).json({ message: "key required" });
    if (!(await storage.isR2KeyInProject(id, key))) return res.status(404).json({ message: "Media not found" });
    try {
      const url = await presignDownload(key, 300);
      res.json({ url, expiresIn: 300 });
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "Failed to presign media" });
    }
  });

  // ===== SCRIPTS =====
  // ===== SCRIPT UPLOADS =====
  app.post("/api/projects/:projectId/scripts/upload", requireAuth, upload.single("file"), async (req, res) => {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (!(await canAccessProject(projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    
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
        const pdfParseModule = await import("pdf-parse");
        const pdfParse = (pdfParseModule as any).default || pdfParseModule;
        const data = await pdfParse(buffer);
        extractedText = data.text;
      } else if (sourceFormat === "docx") {
        const mammoth = (await import("mammoth")).default;
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

      const safeName = originalname.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
      const originalKey = `uploads/${req.user!.id}/scripts/${randomUUID()}-${safeName}`;

      await putObject(originalKey, buffer, mimetype);

      const title = originalname.replace(/\.[^/.]+$/, "");

      const newScript = await storage.createScript({
        projectId,
        title,
        content: extractedText,
      });

      const { scripts } = await import("@shared/schema.js");
      const { eq } = await import("drizzle-orm");

      await db.update(scripts).set({
        sourceType: "upload",
        sourceFormat,
        originalKey
      }).where(eq(scripts.id, newScript.id));
      
      const updatedScript = await storage.getScript(newScript.id);

      res.json(updatedScript);
    } catch (e: any) {
      console.error("Upload error:", e);
      res.status(500).json({ message: `Failed to process script: ${e.message}` });
    }
  });

  app.get("/api/projects/:projectId/scripts/:scriptId/original", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.projectId), 10);
    const scriptId = parseInt(String(req.params.scriptId), 10);
    
    if (!(await canAccessProject(projectId, req.user!.id))) return res.status(403).json({ message: "No access" });

    const script = await storage.getScript(scriptId);
    if (!script) return res.status(404).json({ message: "Script not found" });
    if (script.projectId !== projectId) return res.status(403).json({ message: "Script belongs to another project" });
    if (script.sourceType !== "upload" || !script.originalKey) {
      return res.status(400).json({ message: "No original file available for this script" });
    }

    try {
      if (!process.env.R2_BUCKET || !process.env.R2_ENDPOINT) {
        throw new Error("Cloud storage (R2) is not configured on this server.");
      }
      const url = await presignDownload(script.originalKey, 300);

      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/projects/:id/scripts", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    res.json(await storage.listScriptsLite(id));
  });
  app.post("/api/projects/:id/scripts", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({ title: z.string().optional(), content: z.string().optional() });
    const body = schema.parse(req.body);
    res.json(await storage.createScript({ projectId: id, title: body.title || "Untitled Script", content: body.content || "" }));
  });
  app.patch("/api/projects/:id/scripts/:scriptId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const sid = parseInt(String(req.params.scriptId), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({ title: z.string().optional(), content: z.string().optional() });
    const patch = schema.parse(req.body);
    res.json(await storage.updateScript(sid, patch));
  });
  app.delete("/api/projects/:id/scripts/:scriptId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const sid = parseInt(String(req.params.scriptId), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteScript(sid);
    res.json({ ok: true });
  });

  // ===== STORYBOARDS =====
  app.get("/api/projects/:id/storyboards", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const sbs = await storage.listStoryboards(id);
    const sbIds = sbs.map((sb: any) => sb.id);
    const allPanels = sbIds.length > 0 ? await storage.listPanelsLiteBatch(sbIds) : [];
    const panelsByStoryboard = new Map<number, typeof allPanels>();
    for (const panel of allPanels) {
      const list = panelsByStoryboard.get(panel.storyboardId) ?? [];
      list.push(panel);
      panelsByStoryboard.set(panel.storyboardId, list);
    }
    const out = sbs.map((sb: any) => ({ ...sb, panels: panelsByStoryboard.get(sb.id) ?? [] }));
    res.json(out);
  });
  app.post("/api/projects/:id/storyboards", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({ title: z.string().optional() });
    const body = schema.parse(req.body);
    res.json(await storage.createStoryboard({ projectId: id, title: body.title || "Untitled Storyboard" }));
  });
  app.delete("/api/projects/:id/storyboards/:sbId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const sb = parseInt(String(req.params.sbId), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteStoryboard(sb);
    res.json({ ok: true });
  });

  // ===== PANELS =====
  app.post ("/api/storyboards/:sbId/panels", requireAuth, async (req, res) => {
    const sbId = parseInt(String(req.params.sbId), 10);
    const sb = await storage.getStoryboard(sbId);
    if (!sb) return res.status(404).json({ message: "Storyboard not found" });
    if (!(await canAccessProject(sb.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      imageData: z.string().min(1).optional(),
      r2Key: z.string().min(1).optional(),
      caption: z.string().optional().default(""),
      dialogue: z.string().optional().default(""),
    }).refine((data) => data.imageData || data.r2Key, { message: "imageData or r2Key required" });
    const body = schema.parse(req.body);
    if (body.imageData && body.imageData.length > 14 * 1024 * 1024) {
      return res.status(413).json({ message: "Image too large (max 10MB)" });
    }
    const panels = await storage.listPanels(sbId);
    const orderIdx = panels.length;
    const panel = await storage.createPanel({
      storyboardId: sbId,
      orderIdx,
      imageData: body.imageData || null,
      r2Key: body.r2Key || null,
      caption: body.caption || "",
      dialogue: body.dialogue || "",
    });
    fireAchievements({ userId: req.user!.id, event: "create_panel", projectId: sb.projectId });
    res.json(panel);
  });
  app.post ("/api/storyboards/:sbId/panels/bulk", requireAuth, async (req, res) => {
    const sbId = parseInt(String(req.params.sbId), 10);
    const sb = await storage.getStoryboard(sbId);
    if (!sb) return res.status(404).json({ message: "Storyboard not found" });
    if (!(await canAccessProject(sb.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });

    const schema = z.object({
      panels: z.array(z.object({
        r2Key: z.string().optional(),
        imageData: z.string().optional(),
        caption: z.string().optional().default(""),
        dialogue: z.string().optional().default(""),
        sceneId: z.number().int().nullable().optional(),
      })).min(1),
    });

    const body = schema.parse(req.body);
    const existingPanels = await storage.listPanels(sbId);
    const startIdx = existingPanels.length;

    const panelsToCreate = body.panels.map((p, index) => ({
      storyboardId: sbId,
      orderIdx: startIdx + index,
      r2Key: p.r2Key || null,
      imageData: p.imageData || null,
      caption: p.caption || "",
      dialogue: p.dialogue || "",
      sceneId: p.sceneId || null,
    }));

    const created = await storage.createPanelsBulk(panelsToCreate);
    fireAchievements({ userId: req.user!.id, event: "create_panel", projectId: sb.projectId });
    res.json(created);
  });
  app.patch ("/api/panels/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const panel = await storage.getPanel(id);
    if (!panel) return res.status(404).json({ message: "Not found" });
    const sb = await storage.getStoryboard(panel.storyboardId);
    if (!sb || !(await canAccessProject(sb.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      orderIdx: z.number().int().optional(),
      caption: z.string().optional(),
      dialogue: z.string().optional(),
      notes: z.string().optional(),
      changeRequest: z.string().optional(),
      status: z.string().optional(),
      frameCount: z.number().int().optional(),
      imageData: z.string().nullable().optional(),
      r2Key: z.string().nullable().optional(),
    });
    const patch = schema.parse(req.body);
    res.json(await storage.updatePanel(id, patch));
  });
  app.delete ("/api/panels/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const panel = await storage.getPanel(id);
    if (!panel) return res.status(404).json({ message: "Not found" });
    const sb = await storage.getStoryboard(panel.storyboardId);
    if (!sb || !(await canAccessProject(sb.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deletePanel(id);
    res.json({ ok: true });
  });

  app.post("/api/storyboards/:sbId/panels/reorder", requireAuth, async (req, res) => {
    const sbId = parseInt(String(req.params.sbId), 10);
    const sb = await storage.getStoryboard(sbId);
    if (!sb) return res.status(404).json({ message: "Storyboard not found" });
    if (!(await canAccessProject(sb.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({ orderedIds: z.array(z.number().int()) });
    const { orderedIds } = schema.parse(req.body);
    await storage.reorderPanels(sbId, orderedIds);
    res.json({ ok: true });
  });

  app.get("/api/storyboards/:sbId/pins", requireAuth, async (req, res) => {
    const sbId = parseInt(String(req.params.sbId), 10);
    const sb = await storage.getStoryboard(sbId);
    if (!sb) return res.status(404).json({ message: "Storyboard not found" });
    if (!(await canAccessProject(sb.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const pins = await storage.listPanelPinsForStoryboard(sbId);
    const authorIds = [...new Set<number>(pins.map((p: any) => p.authorId as number))];
    const authors = await storage.getUsersByIds(authorIds);
    const authorMap = new Map(authors.map((a) => [a.id, a]));
    res.json(pins.map((p: any) => {
      const author = authorMap.get(p.authorId);
      return {
        ...p,
        author: author ? { id: author.id, name: author.name, avatarColor: author.avatarColor } : null,
      };
    }));
  });

  // ===== ANIMATICS =====
  app.get("/api/projects/:id/animatics", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    res.json(await storage.listAnimatics(id));
  });
  app.post("/api/projects/:id/animatics", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
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
    fireAchievements({ userId: req.user!.id, event: "create_animatic", projectId: id });
    notifyDiscord(id, `Animatic Published`, `Animatic "${created.title}" has been published.`);
    res.json(created);
  });
  app.delete("/api/projects/:id/animatics/:aId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const aId = parseInt(String(req.params.aId), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteAnimatic(aId);
    res.json({ ok: true });
  });

  // ===== SCENES =====
  app.get("/api/projects/:id/scenes", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    res.json(await storage.listScenes(id));
  });
  app.post("/api/projects/:id/scenes", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      number: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      deadline: z.string().nullable().optional(),
      assigneeId: z.number().nullable().optional(),
    });
    const body = schema.parse(req.body);
    const scene = await storage.createScene({
      projectId: id,
      number: body.number || "1",
      title: body.title || "Untitled Scene",
      description: body.description || "",
      status: body.status || "script",
      deadline: body.deadline ?? null,
      assigneeId: body.assigneeId ?? null,
    });
    fireAchievements({ userId: req.user!.id, event: "create_scene", projectId: id });
    res.json(scene);
  });
  app.patch("/api/projects/:id/scenes/:sceneId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const sceneId = parseInt(String(req.params.sceneId), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
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
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteScene(sceneId);
    res.json({ ok: true });
  });

  app.get("/api/projects/:id/scene-timers", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const timers = await storage.getActiveSceneTimersForProject(id, req.user!.id);
    res.json(timers);
  });

  // ===== COMMENTS =====
  app.get("/api/projects/:id/comments", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);
    const cursor = req.query.cursor ? parseInt(String(req.query.cursor), 10) : undefined;
    const { items, nextCursor } = await storage.listComments(id, { limit, cursor });
    const authorIds = Array.from(new Set(items.map((c) => c.authorId)));
    const authors = await storage.getUsersByIds(authorIds);
    const authorMap = new Map(authors.map((a) => [a.id, a]));
    const enriched = items.map((c) => {
      const author = authorMap.get(c.authorId);
      return {
        ...c,
        author: author ? { id: author.id, name: author.name, avatarColor: author.avatarColor } : null,
      };
    });
    res.json({ items: enriched, nextCursor });
  });
  app.post("/api/projects/:id/comments", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({ body: z.string().min(1), sceneId: z.number().nullable().optional() });
    const body = schema.parse(req.body);
    const comment = await storage.createComment({
      projectId: id, authorId: req.user!.id, body: body.body, sceneId: body.sceneId ?? null,
    });
    
    notifyDiscord(id, `New Comment from ${req.user!.name}`, body.body);
    fireAchievements({ userId: req.user!.id, event: "create_comment", projectId: id });

    res.json(comment);
  });
  app.delete("/api/projects/:id/comments/:commentId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const cid = parseInt(String(req.params.commentId), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteComment(cid);
    res.json({ ok: true });
  });

  // ===== ASSETS =====
  app.get("/api/projects/:id/assets", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const category = req.query.category as string | undefined;
    const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);
    const cursor = req.query.cursor ? parseInt(String(req.query.cursor), 10) : undefined;
    const { items, nextCursor } = await storage.listAssets(id, category, { limit, cursor });
    res.json({ items, nextCursor });
  });

  app.post("/api/projects/:id/assets", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      category: z.string().optional().default("Other"),
      filename: z.string().min(1),
      mimeType: z.string().optional().default(""),
      fileData: z.string().optional(),
      r2Key: z.string().optional(),
      thumbnailData: z.string().nullable().optional(),
      notes: z.string().optional().default(""),
      tags: z.string().optional().default(""),
    }).refine((body) => Boolean(body.r2Key || body.fileData), { message: "r2Key or fileData required" });
    const body = schema.parse(req.body);
    if (body.fileData && body.fileData.length > 14 * 1024 * 1024) {
      return res.status(413).json({ message: "File too large (max 10MB)" });
    }
    const asset = await storage.createAsset({
      projectId: id,
      uploaderId: req.user!.id,
      category: body.category,
      filename: body.filename,
      mimeType: body.mimeType,
      r2Key: body.r2Key ?? null,
      fileData: body.r2Key ? null : (body.fileData ?? null),
      thumbnailData: body.r2Key ? null : (body.thumbnailData ?? null),
      notes: body.notes,
      tags: body.tags,
    });
    const { fileData, ...safe } = asset;
    res.json(safe);
  });

  app.patch ("/api/assets/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const asset = await storage.getAsset(id);
    if (!asset) return res.status(404).json({ message: "Not found" });
    if (!(await canAccessProject(asset.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
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
    if (!(await canAccessProject(asset.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteAsset(id);
    res.json({ ok: true });
  });

  app.get ("/api/assets/:id/download", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const asset = await storage.getAsset(id);
    if (!asset) return res.status(404).json({ message: "Not found" });
    if (!(await canAccessProject(asset.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    if (asset.r2Key) {
      try {
        const url = await presignDownload(asset.r2Key, 300);
        return res.json({ url, filename: asset.filename, mimeType: asset.mimeType, r2Key: asset.r2Key });
      } catch (err: any) {
        return res.status(500).json({ message: err?.message ?? "Failed to presign asset" });
      }
    }
    res.json({ fileData: asset.fileData, filename: asset.filename, mimeType: asset.mimeType });
  });

  // ===== COMMISSIONS (public intake) =====
  app.post("/api/commissions", commissionLimiter, async (req, res) => {
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
    if (!(await storage.getUser(body.ownerUserId))) {
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
    fireAchievements({ userId: body.ownerUserId, event: "create_commission" });
    res.json(commission);
  });

  app.get ("/api/commissions", requireAuth, async (req, res) => {
    const list = await storage.listCommissions(req.user!.id);
    // Omit large reference images from list view
    const safe = list.map(({ referenceImage, ...rest }: any) => ({ ...rest, hasReferenceImage: !!referenceImage }));
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
    if (patch.status === "delivered") {
      fireAchievements({ userId: req.user!.id, event: "deliver_commission" });
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
    if (!(await canAccessProject(scene.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    res.json(await storage.listRenders(sceneId));
  });

  app.post ("/api/scenes/:sceneId/renders", requireAuth, async (req, res) => {
    const sceneId = parseInt(String(req.params.sceneId), 10);
    const scene = await storage.getScene(sceneId);
    if (!scene) return res.status(404).json({ message: "Scene not found" });
    if (!(await canAccessProject(scene.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
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
    if (!scene || !(await canAccessProject(scene.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
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
    if (!scene || !(await canAccessProject(scene.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteRender(id);
    res.json({ ok: true });
  });

  // ===== ANIMATIC PROJECTS v2 =====
  app.get("/api/projects/:projectId/animatics-v2", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (!(await canAccessProject(projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    res.json(await storage.getAnimaticProjectsByProject(projectId));
  });

  app.post("/api/projects/:projectId/animatics-v2", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (!(await canAccessProject(projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      title: z.string().optional().default("Untitled Animatic"),
      fps: z.number().int().optional().default(24),
      totalDurationMs: z.number().int().optional().default(8000),
    });
    const body = schema.parse(req.body);
    const ap = await storage.createAnimaticProject({ projectId, title: body.title, fps: body.fps, totalDurationMs: body.totalDurationMs });
    fireAchievements({ userId: req.user!.id, event: "create_animatic", projectId });
    res.json(ap);
  });

  app.get ("/api/animatics-v2/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const ap = await storage.getAnimaticProject(id);
    if (!ap) return res.status(404).json({ message: "Not found" });
    if (!(await canAccessProject(ap.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    res.json(ap);
  });

  app.patch ("/api/animatics-v2/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const ap = await storage.getAnimaticProject(id);
    if (!ap) return res.status(404).json({ message: "Not found" });
    if (!(await canAccessProject(ap.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
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
    if (!(await canAccessProject(ap.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteAnimaticProject(id);
    res.json({ ok: true });
  });

  // ===== ANIMATIC TRACKS =====
  app.post ("/api/animatics-v2/:id/tracks", requireAuth, async (req, res) => {
    const animaticId = parseInt(String(req.params.id), 10);
    const ap = await storage.getAnimaticProject(animaticId);
    if (!ap) return res.status(404).json({ message: "Not found" });
    if (!(await canAccessProject(ap.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      kind: z.string().optional().default("sfx"),
      name: z.string().optional().default("New Track"),
      orderIdx: z.number().int().optional().default(99),
      muted: z.boolean().optional().default(false),
      volume: z.coerce.number().int().optional().default(1000),
    });
    const body = schema.parse(req.body);
    const track = await storage.createTrack({
      animaticProjectId: animaticId,
      kind: body.kind,
      name: body.name,
      orderIdx: body.orderIdx,
      muted: body.muted,
      volume: body.volume,
    });
    res.json(track);
  });

  app.patch ("/api/tracks/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const track = await storage.getTrack(id);
    if (!track) return res.status(404).json({ message: "Not found" });
    const ap = await storage.getAnimaticProject(track.animaticProjectId);
    if (!ap || !(await canAccessProject(ap.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      kind: z.string().optional(),
      name: z.string().optional(),
      orderIdx: z.number().int().optional(),
      muted: z.boolean().optional(),
      volume: z.coerce.number().int().optional(),
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
    if (!ap || !(await canAccessProject(ap.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteTrack(id);
    res.json({ ok: true });
  });

  // ===== ANIMATIC CLIPS =====
  app.post ("/api/tracks/:id/clips", requireAuth, async (req, res) => {
    const trackId = parseInt(String(req.params.id), 10);
    const track = await storage.getTrack(trackId);
    if (!track) return res.status(404).json({ message: "Not found" });
    const ap = await storage.getAnimaticProject(track.animaticProjectId);
    if (!ap || !(await canAccessProject(ap.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      startMs: z.number().int().optional().default(0),
      durationMs: z.number().int().optional().default(2000),
      sourceKind: z.string().optional().default("panel_ref"),
      sourceId: z.number().int().nullable().optional(),
      audioDataUrl: z.string().nullable().optional(),
      label: z.string().optional().default(""),
      fadeInMs: z.number().int().optional().default(0),
      fadeOutMs: z.number().int().optional().default(0),
      volume: z.coerce.number().int().optional().default(1000),
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
    if (!ap || !(await canAccessProject(ap.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      startMs: z.number().int().optional(),
      durationMs: z.number().int().optional(),
      sourceKind: z.string().optional(),
      sourceId: z.number().int().nullable().optional(),
      audioDataUrl: z.string().nullable().optional(),
      label: z.string().optional(),
      fadeInMs: z.number().int().optional(),
      fadeOutMs: z.number().int().optional(),
      volume: z.coerce.number().int().optional(),
    });
    const patch = schema.parse(req.body);
    const updated = await storage.updateClip(id, patch);
    res.json(updated);
  });

  app.delete ("/api/clips/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const clip = await storage.getClip(id);
    if (!clip) return res.status(404).json({ message: "Not found" });
    const track = await storage.getTrack(clip.trackId);
    if (!track) return res.status(404).json({ message: "Track not found" });
    const ap = await storage.getAnimaticProject(track.animaticProjectId);
    if (!ap || !(await canAccessProject(ap.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteClip(id);
    res.json({ ok: true });
  });

  // ===== FREESOUND PROXY =====
  app.get("/api/freesound/search", requireAuth, async (req, res) => {
    const apiKey = process.env.FREESOUND_API_KEY;
    if (!apiKey) {
      console.warn("[Cel] FREESOUND_API_KEY not set — sound effects search will not work. Get a free key at https://freesound.org/apiv2/apply/");
      return res.status(503).json({ message: "Freesound API key not configured. See server console.", results: { results: [] } });
    }
    const q = String(req.query.q || "");
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
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
    const apiKey = process.env.FREESOUND_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ message: "Freesound API key not configured." });
    }
    const soundId = parseInt(String(req.params.soundId), 10);
    if (!Number.isInteger(soundId)) return res.status(400).json({ message: "Invalid sound id" });
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
    const scripts = await storage.listScriptsLite(p.id);
    const sbs = await storage.listStoryboards(p.id);
    const sharePanels = await storage.listPanelsForStoryboardIds(sbs.map((sb: any) => sb.id));
    const sharePanelsByStoryboard = new Map<number, any[]>();
    for (const panel of sharePanels) {
      const list = sharePanelsByStoryboard.get(panel.storyboardId) ?? [];
      list.push(panel);
      sharePanelsByStoryboard.set(panel.storyboardId, list);
    }
    const storyboards = sbs.map((sb: any) => ({ ...sb, panels: sharePanelsByStoryboard.get(sb.id) ?? [] }));
    const animatics = await storage.listAnimatics(p.id);
    const scenes = await storage.listScenes(p.id);
    res.json({
      project: { ...p, shareToken: undefined },
      owner: owner ? { name: owner.name, avatarColor: owner.avatarColor } : null,
      scripts, storyboards, animatics, scenes,
    });
  });

  app.get("/api/share/:token/media", async (req, res) => {
    const token = req.params.token;
    const p = await storage.getProjectByToken(token);
    if (!p || !p.shareEnabled) return res.status(404).json({ message: "Share link not found or disabled" });
    const key = String(req.query.key ?? "");
    if (!key) return res.status(400).json({ message: "key required" });
    if (!(await storage.isR2KeyInProject(p.id, key))) return res.status(404).json({ message: "Media not found" });
    try {
      const url = await presignDownload(key, 300);
      res.json({ url, expiresIn: 300 });
    } catch (err: any) {
      res.status(500).json({ message: err?.message ?? "Failed to presign media" });
    }
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
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const row = await storage.getProjectAiKey(id);
    res.json({ hasKey: !!row, model: row?.model || null });
  });

  app.post("/api/projects/:id/ai/key", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({ key: z.string().min(1), model: z.string().optional() });
    const body = schema.parse(req.body);
    await storage.setProjectAiKey(id, encrypt(body.key), body.model);
    res.json({ ok: true });
  });

  app.delete("/api/projects/:id/ai/key", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteProjectAiKey(id);
    res.json({ ok: true });
  });

  app.post("/api/projects/:id/ai/shot-suggest", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({ scriptText: z.string().min(1) });
    let body: { scriptText: string };
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }

    const keyRow = await storage.getProjectAiKey(id);
    if (!keyRow) return res.status(400).json({ message: "No AI key set for this project" });
    const apiKey = decrypt(keyRow.encryptedKey);

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
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const sessions = await storage.listAiChatSessions(id);
    res.json(sessions);
  });

  app.post("/api/projects/:id/ai/sessions", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({ title: z.string().optional(), scriptId: z.number().optional() });
    const body = schema.parse(req.body);
    const session = await storage.createAiChatSession({ projectId: id, ...body });
    res.json(session);
  });

  app.delete("/api/projects/:id/ai/sessions/:sessionId", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const chatSession = await storage.getAiChatSession(parseInt(String(req.params.sessionId), 10));
    if (!chatSession || chatSession.projectId !== id) return res.status(404).json({ message: "Session not found" });
    await storage.deleteAiChatSession(chatSession.id);
    res.json({ ok: true });
  });

  app.get("/api/projects/:id/ai/sessions/:sessionId/messages", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const chatSession = await storage.getAiChatSession(parseInt(String(req.params.sessionId), 10));
    if (!chatSession || chatSession.projectId !== id) return res.status(404).json({ message: "Session not found" });
    res.json(await storage.listAiChatMessages(chatSession.id));
  });

  app.post("/api/projects/:id/ai/chat", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    
    const schema = z.object({
      sessionId: z.number(),
      content: z.string(),
      scriptContent: z.string(), // Provide current script context
    });
    let body;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }

    const chatSession = await storage.getAiChatSession(body.sessionId);
    if (!chatSession || chatSession.projectId !== id) return res.status(404).json({ message: "Session not found" });

    const keyRow = await storage.getProjectAiKey(id);
    if (!keyRow) return res.status(400).json({ message: "No AI key set for this project" });
    const apiKey = decrypt(keyRow.encryptedKey);
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

    const messages = (await storage.listAiChatMessages(body.sessionId)).map((m: any) => {
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
              toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
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
    const projectId = parseInt(String(req.params.projectId), 10);
    if (!(await canAccessProject(projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
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
    const { ACHIEVEMENT_DEFS } = await import("./achievements");
    const unlocked: any[] = await storage.listAchievements(req.user!.id);
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
    if (!sb || !(await canAccessProject(sb.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const pins = await storage.listPanelPins(id);
    const authorIds = [...new Set<number>(pins.map((p: any) => p.authorId as number))];
    const authors = await storage.getUsersByIds(authorIds);
    const authorMap = new Map(authors.map((a) => [a.id, a]));
    res.json(pins.map((p: any) => {
      const author = authorMap.get(p.authorId);
      return {
        ...p,
        author: author ? { id: author.id, name: author.name, avatarColor: author.avatarColor } : null,
      };
    }));
  });

  app.post ("/api/panels/:id/pins", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const panel = await storage.getPanel(id);
    if (!panel) return res.status(404).json({ message: "Panel not found" });
    const sb = await storage.getStoryboard(panel.storyboardId);
    if (!sb || !(await canAccessProject(sb.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      xPercent: z.number().min(0).max(100),
      yPercent: z.number().min(0).max(100),
      body: z.string().min(1),
    });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const pin = await storage.createPanelPin({ panelId: id, ...body, authorId: req.user!.id });
    res.json(pin);
  });

  app.delete ("/api/pins/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const pin = await storage.getPanelPin(id);
    if (!pin) return res.status(404).json({ message: "Not found" });
    const panel = await storage.getPanel(pin.panelId);
    if (!panel) return res.status(404).json({ message: "Panel not found" });
    const sb = await storage.getStoryboard(panel.storyboardId);
    if (!sb || !(await canAccessProject(sb.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deletePanelPin(id);
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
    res.json(await storage.listPanelPins(panelId));
  });

  // ===== v4 COMMISSION LINE ITEMS =====
  app.get ("/api/commissions/:id/line-items", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const c = await storage.getCommission(id);
    if (!c) return res.status(404).json({ message: "Not found" });
    if (c.ownerUserId !== req.user!.id) return res.status(403).json({ message: "No access" });
    res.json(await storage.listCommissionLineItems(id));
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
    res.json(await storage.createCommissionLineItem({ commissionId: id, ...body }));
  });

  app.patch ("/api/commission-line-items/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const lineItem = await storage.getCommissionLineItem(id);
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
    res.json(await storage.updateCommissionLineItem(id, patch));
  });

  app.delete ("/api/commission-line-items/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const lineItem = await storage.getCommissionLineItem(id);
    if (!lineItem) return res.status(404).json({ message: "Not found" });
    const c = await storage.getCommission(lineItem.commissionId);
    if (!c || c.ownerUserId !== req.user!.id) return res.status(403).json({ message: "No access" });
    await storage.deleteCommissionLineItem(id);
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
    await storage.updateCommissionQuote(id, body.quoteCents, body.invoicedAt);
    res.json(await storage.getCommission(id));
  });

  // ===== v4 COMMISSION PRICING PRESETS =====
  app.get("/api/projects/:id/pricing-presets", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    res.json(await storage.listCommissionPricingPresets(id));
  });

  app.post("/api/projects/:id/pricing-presets", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(id, req.user!.id))) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      kind: z.enum(["package", "addon"]).optional().default("package"),
      name: z.string().min(1),
      description: z.string().optional().default(""),
      priceCents: z.number().int().min(0),
    });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    res.json(await storage.createCommissionPricingPreset({ projectId: id, ...body }));
  });

  app.delete ("/api/pricing-presets/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const preset = await storage.getCommissionPricingPreset(id);
    if (!preset) return res.status(404).json({ message: "Not found" });
    if (!(await canAccessProject(preset.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    await storage.deleteCommissionPricingPreset(id);
    res.json({ ok: true });
  });

  // ===== v4 INBOX =====
  app.get ("/api/inbox", requireAuth, async (req, res) => {
    res.json(await storage.listInboxItems(req.user!.id));
  });

  app.post("/api/inbox", requireAuth, async (req, res) => {
    const schema = z.object({
      body: z.string().min(1),
      tags: z.string().optional().default(""),
      projectId: z.number().int().nullable().optional(),
    });
    let item: any;
    try { item = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    res.json(await storage.createInboxItem({ userId: req.user!.id, ...item }));
  });

  app.patch ("/api/inbox/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const item = await storage.getInboxItem(id);
    if (!item || item.userId !== req.user!.id) return res.status(403).json({ message: "No access" });
    const schema = z.object({
      body: z.string().min(1).optional(),
      tags: z.string().optional(),
      projectId: z.number().int().nullable().optional(),
    });
    let patch: any;
    try { patch = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    res.json(await storage.updateInboxItem(id, patch));
  });

  app.delete ("/api/inbox/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const item = await storage.getInboxItem(id);
    if (!item || item.userId !== req.user!.id) return res.status(403).json({ message: "No access" });
    await storage.deleteInboxItem(id);
    res.json({ ok: true });
  });

  // ===== v4 TAGS =====
  app.get ("/api/tags", requireAuth, async (req, res) => {
    res.json(await storage.listTags(req.user!.id));
  });

  app.post("/api/tags", requireAuth, async (req, res) => {
    const schema = z.object({ name: z.string().min(1), color: z.string().optional().default("#6E4FE8") });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    res.json(await storage.createTag({ userId: req.user!.id, ...body }));
  });

  app.patch ("/api/tags/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const tag = await storage.getTag(id);
    if (!tag) return res.status(404).json({ message: "Not found" });
    if (tag.userId !== req.user!.id) return res.status(403).json({ message: "No access" });
    const schema = z.object({ name: z.string().min(1).optional(), color: z.string().optional() });
    let patch: any;
    try { patch = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    res.json(await storage.updateTag(id, patch));
  });

  app.delete ("/api/tags/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const tag = await storage.getTag(id);
    if (!tag) return res.status(404).json({ message: "Not found" });
    if (tag.userId !== req.user!.id) return res.status(403).json({ message: "No access" });
    await storage.deleteTag(id);
    res.json({ ok: true });
  });

  app.get("/api/tag-assignments", requireAuth, async (req, res) => {
    const { kind, entityId } = req.query as { kind: string; entityId: string };
    if (!kind || !entityId) return res.status(400).json({ message: "kind and entityId required" });
    const entityNum = parseInt(entityId, 10);
    if (!Number.isInteger(entityNum)) return res.status(400).json({ message: "entityId must be an integer" });
    // Only reveal assignments made with the caller's own tags.
    const ownTagIds = new Set((await storage.listTags(req.user!.id)).map((t) => t.id));
    const assignments = await storage.listTagAssignments(kind, entityNum);
    res.json(assignments.filter((a) => ownTagIds.has(a.tagId)));
  });

  app.post("/api/tag-assignments", requireAuth, async (req, res) => {
    const schema = z.object({
      tagId: z.number().int(),
      entityKind: z.enum(["scene", "asset", "panel", "inboxItem"]),
      entityId: z.number().int(),
    });
    let body: any;
    try { body = schema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const tag = await storage.getTag(body.tagId);
    if (!tag || tag.userId !== req.user!.id) return res.status(403).json({ message: "No access" });
    res.json(await storage.createTagAssignment(body));
  });

  app.delete ("/api/tag-assignments/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const assignment = await storage.getTagAssignment(id);
    if (!assignment) return res.status(404).json({ message: "Not found" });
    const tag = await storage.getTag(assignment.tagId);
    if (!tag || tag.userId !== req.user!.id) return res.status(403).json({ message: "No access" });
    await storage.deleteTagAssignment(id);
    res.json({ ok: true });
  });

  // ===== v4 SCENE TIMER =====
  app.get ("/api/scenes/:id/time", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const scene = await storage.getScene(id);
    if (!scene) return res.status(404).json({ message: "Scene not found" });
    if (!(await canAccessProject(scene.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const entries = await storage.listSceneTimeEntriesForUser(id, req.user!.id);
    const totalMs = entries.filter((e) => e.durationMs).reduce((sum, e) => sum + (e.durationMs ?? 0), 0);
    const active = entries.find((e) => !e.endedAt) ?? null;
    res.json({ entries, totalMs, active });
  });

  app.post ("/api/scenes/:id/timer/start", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const scene = await storage.getScene(id);
    if (!scene) return res.status(404).json({ message: "Scene not found" });
    if (!(await canAccessProject(scene.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    // Stop any already-running timer first
    const existing = await storage.getActiveTimeEntry(id, req.user!.id);
    if (existing) {
      await storage.stopTimer(existing.id);
    }
    const entry = await storage.startTimer(id, req.user!.id);
    res.json(entry);
  });

  app.post ("/api/scenes/:id/timer/stop", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const scene = await storage.getScene(id);
    if (!scene) return res.status(404).json({ message: "Scene not found" });
    if (!(await canAccessProject(scene.projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    const active = await storage.getActiveTimeEntry(id, req.user!.id);
    if (!active) return res.status(404).json({ message: "No active timer" });
    const entry = await storage.stopTimer(active.id);
    res.json(entry);
  });

  // ===== v4 GLOBAL SEARCH =====
  app.get("/api/search", requireAuth, async (req, res) => {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(parseInt(String(req.query.limit || "20"), 10) || 20, 50);
    if (!q || q.length < 1) return res.json({ projects: [], scenes: [], scripts: [], assets: [], comments: [] });
    try {
      const results = await storage.globalSearch(req.user!.id, q, limit);
      res.json(results);
    } catch (e) {
      sendError(res, e);
    }
  });

  app.post("/api/aud/voice_takes", requireAuth, async (req, res) => {
    try {
      const data = insertAudVoiceTakeSchema.parse(req.body);
      if (data.projectId && !(await canAccessProject(data.projectId, req.user!.id))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const take = await storage.createAudVoiceTake(data);
      res.json(take);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/projects/:id/aud/voice_takes", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.id));
      if (!(await canAccessProject(projectId, req.user!.id))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const takes = await storage.getAudVoiceTakesByProject(projectId);
      res.json(takes);
    } catch(e:any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post ("/api/animatics/:id/aud/captions", requireAuth, async (req, res) => {
    try {
      const animaticProjectId = parseInt(String(req.params.id));
      const ap = await storage.getAnimaticProject(animaticProjectId);
      if (!ap || !(await canAccessProject(ap.projectId, req.user!.id))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const data = insertAudCaptionSchema.parse({ ...req.body, animaticProjectId });
      const caption = await storage.createAudCaption(data);
      res.json(caption);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get ("/api/animatics/:id/aud/captions", requireAuth, async (req, res) => {
    try {
      const animaticProjectId = parseInt(String(req.params.id));
      const ap = await storage.getAnimaticProject(animaticProjectId);
      if (!ap || !(await canAccessProject(ap.projectId, req.user!.id))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const captions = await storage.getAudCaptionsByAnimatic(animaticProjectId);
      res.json(captions);
    } catch(e:any) {
      res.status(400).json({ error: e.message });
    }
  });
  
  app.delete ("/api/aud/captions/:id", requireAuth, async (req, res) => {
    try {
       const id = parseInt(String(req.params.id));
       const caption = await storage.getAudCaption(id);
       if (caption) {
         const ap = await storage.getAnimaticProject(caption.animaticProjectId);
         if (!ap || !(await canAccessProject(ap.projectId, req.user!.id))) {
           return res.status(403).json({ message: "Forbidden" });
         }
       }
       await storage.deleteAudCaption(id);
       res.json({ success: true });
    } catch (e: any) {
       res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/analytics/commission-hours", requireAuth, async (req, res) => {
    try {
      // Scope to user's own commissions via join
      const hours = await db
        .select({
          commissionId: dltCommissionHours.commissionId,
          hours: dltCommissionHours.hours,
        })
        .from(dltCommissionHours)
        .innerJoin(commissions, eq(dltCommissionHours.commissionId, commissions.id))
        .where(eq(commissions.ownerUserId, req.user!.id))
        ;

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
      
      const record = await storage.addCommissionHours({ commissionId, hours: parsedHours });
      res.json(record);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/analytics/heatmap", requireAuth, async (req, res) => {
    try {
      // Gather scene time entries scoped to the current user's projects
      const entries = await db.select({
        sceneId: scenes.id,
        sceneName: scenes.title,
        startedAt: sceneTimeEntries.startedAt,
        durationMs: sceneTimeEntries.durationMs,
      })
      .from(sceneTimeEntries)
      .innerJoin(scenes, eq(sceneTimeEntries.sceneId, scenes.id))
      .innerJoin(projects, eq(scenes.projectId, projects.id))
      .where(eq(projects.ownerId, req.user!.id))
      ;
      
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
      const sceneRows = await db.select({
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
        ;

      const entries = await db.select({
        sceneId: scenes.id,
        startedAt: sceneTimeEntries.startedAt,
        durationMs: sceneTimeEntries.durationMs,
      })
        .from(sceneTimeEntries)
        .innerJoin(scenes, eq(sceneTimeEntries.sceneId, scenes.id))
        .innerJoin(projects, eq(scenes.projectId, projects.id))
        .where(eq(projects.ownerId, req.user!.id))
        ;

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
  async function checkShareOrMemberAccess(req: Request, projectId: number): Promise<{ status: number; message: string } | null> {
    const shareToken = req.query.token as string | undefined;
    if (shareToken) {
      const project = await storage.getProjectByToken(shareToken);
      if (!project || project.id !== projectId || !project.shareEnabled) return { status: 403, message: "No access" };
      return null;
    }
    const auth = await authenticateToken(extractToken(req));
    if (!auth.ok) return { status: 401, message: auth.reason === "revoked" ? "Session revoked" : "Not authenticated" };
    if (!(await canAccessProject(projectId, auth.user.id))) return { status: 403, message: "No access" };
    return null;
  }

  app.get ("/api/projects/:id/cli_approvals", async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.id), 10);
      const denied = await checkShareOrMemberAccess(req, projectId);
      if (denied) return res.status(denied.status).json({ message: denied.message });
      const approvals = await storage.getCliApprovals(projectId);
      res.json(approvals);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post ("/api/projects/:id/cli_approvals", async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.id), 10);
      const denied = await checkShareOrMemberAccess(req, projectId);
      if (denied) return res.status(denied.status).json({ message: denied.message });
      const { phase, signedName, signatureData, signedAt } = req.body;
      const approval = await storage.createCliApproval({ projectId, phase, signedName, signatureData, signedAt });
      res.json(approval);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get ("/api/projects/:id/cli_feedback", async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.id), 10);
      const denied = await checkShareOrMemberAccess(req, projectId);
      if (denied) return res.status(denied.status).json({ message: denied.message });
      const feedback = await storage.getCliFeedback(projectId);
      res.json(feedback);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post ("/api/projects/:id/cli_feedback", async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.id), 10);
      const denied = await checkShareOrMemberAccess(req, projectId);
      if (denied) return res.status(denied.status).json({ message: denied.message });
      const { sceneId, fields } = req.body;
      const feedback = await storage.createCliFeedback({ projectId, sceneId, fields });
      res.json(feedback);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return httpServer;
}
