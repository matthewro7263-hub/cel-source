import { Express, Request, Response, NextFunction } from "express";
import { storage, getSessionUser } from "./storage";
import { z } from "zod";

/**
 * MCP Mirroring Endpoints
 * These provide structured JSON outputs for AI/Agentic integration.
 * Errors follow { error: string, code: string }.
 *
 * All routes require Bearer auth and verify the caller can access the
 * project. Never trust client-supplied user IDs.
 */

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string };
    }
  }
}

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth) return undefined;
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return undefined;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const userId = token ? getSessionUser(token) : null;
  if (!userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  const user = storage.getUser(userId);
  if (!user) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  req.user = { id: user.id, email: user.email };
  next();
}

function canAccessProject(projectId: number, userId: number): boolean {
  const p = storage.getProject(projectId);
  if (!p) return false;
  if (p.ownerId === userId) return true;
  return storage.isMember(projectId, userId);
}

export function registerMcpRoutes(app: Express) {
  const mcpError = (res: Response, message: string, code: string, status = 400) => {
    return res.status(status).json({ error: message, code });
  };

  // 1. list_shots(projectId)
  app.post("/api/mcp/list_shots", requireAuth, async (req, res) => {
    try {
      const schema = z.object({ projectId: z.number() });
      const { projectId } = schema.parse(req.body);

      if (!canAccessProject(projectId, req.user!.id)) {
        return mcpError(res, "Forbidden", "FORBIDDEN", 403);
      }

      const shots = storage.listScenes(projectId);
      res.json({ shots });
    } catch (e: any) {
      mcpError(res, e.message, "INVALID_REQUEST");
    }
  });

  // 2. update_shot_status(projectId, shotId, status)
  app.post("/api/mcp/update_shot_status", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        projectId: z.number(),
        shotId: z.number(),
        status: z.string()
      });
      const { projectId, shotId, status } = schema.parse(req.body);

      if (!canAccessProject(projectId, req.user!.id)) {
        return mcpError(res, "Forbidden", "FORBIDDEN", 403);
      }

      const shot = storage.getScene(shotId);
      if (!shot || shot.projectId !== projectId) {
        return mcpError(res, "Shot not found in project", "NOT_FOUND", 404);
      }

      const updated = storage.updateScene(shotId, { status });
      res.json({ shot: updated });
    } catch (e: any) {
      mcpError(res, e.message, "INVALID_REQUEST");
    }
  });

  // 3. add_comment(projectId, entityType, entityId, body)
  app.post("/api/mcp/add_comment", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        projectId: z.number(),
        entityType: z.enum(["scene", "panel", "asset"]),
        entityId: z.number(),
        body: z.string()
      });
      const { projectId, entityType, entityId, body } = schema.parse(req.body);

      if (!canAccessProject(projectId, req.user!.id)) {
        return mcpError(res, "Forbidden", "FORBIDDEN", 403);
      }

      const comment = storage.createComment({
        projectId,
        authorId: req.user!.id,
        body,
        sceneId: entityType === "scene" ? entityId : null
      });

      res.json({ comment });
    } catch (e: any) {
      mcpError(res, e.message, "INVALID_REQUEST");
    }
  });

  // 4. upload_asset(projectId, file, metadata)
  app.post("/api/mcp/upload_asset", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        projectId: z.number(),
        filename: z.string(),
        fileData: z.string(), // base64
        metadata: z.object({
          category: z.string().optional(),
          notes: z.string().optional(),
          tags: z.string().optional()
        }).optional()
      });
      const { projectId, filename, fileData, metadata } = schema.parse(req.body);

      if (!canAccessProject(projectId, req.user!.id)) {
        return mcpError(res, "Forbidden", "FORBIDDEN", 403);
      }

      const asset = storage.createAsset({
        projectId,
        uploaderId: req.user!.id,
        filename,
        fileData,
        category: metadata?.category || "Other",
        notes: metadata?.notes || "",
        tags: metadata?.tags || "",
        mimeType: "application/octet-stream"
      });

      const { fileData: _, ...safe } = asset;
      res.json({ asset: safe });
    } catch (e: any) {
      mcpError(res, e.message, "INVALID_REQUEST");
    }
  });

  // 5. list_assets(projectId, type?)
  app.post("/api/mcp/list_assets", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        projectId: z.number(),
        type: z.string().optional()
      });
      const { projectId, type } = schema.parse(req.body);

      if (!canAccessProject(projectId, req.user!.id)) {
        return mcpError(res, "Forbidden", "FORBIDDEN", 403);
      }

      const assets = storage.listAssets(projectId, type);
      const safe = assets.map(({ fileData, ...rest }) => rest);
      res.json({ assets: safe });
    } catch (e: any) {
      mcpError(res, e.message, "INVALID_REQUEST");
    }
  });
}
