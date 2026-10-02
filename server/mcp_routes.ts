import { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { authenticateToken, canAccessProject, canEditProject, extractToken } from "./auth";
import { z } from "zod";

/**
 * MCP Mirroring Endpoints
 * These provide structured JSON outputs for AI/Agentic integration.
 * Errors follow { error: string, code: string }.
 *
 * All routes require Bearer auth and verify the caller can access the
 * project. Never trust client-supplied user IDs.
 */

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authenticateToken(extractToken(req));
    if (!result.ok) {
      return result.reason === "revoked"
        ? res.status(401).json({ error: "Session revoked", code: "SESSION_REVOKED" })
        : res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    }
    req.user = result.user;
    next();
  } catch (err) {
    next(err);
  }
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

      if (!await canAccessProject(projectId, req.user!.id)) {
        return mcpError(res, "Forbidden", "FORBIDDEN", 403);
      }

      const shots = await storage.listScenes(projectId);
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

      if (!await canEditProject(projectId, req.user!.id)) {
        return mcpError(res, "Forbidden", "FORBIDDEN", 403);
      }

      const shot = await storage.getScene(shotId);
      if (!shot || shot.projectId !== projectId) {
        return mcpError(res, "Shot not found in project", "NOT_FOUND", 404);
      }

      const updated = await storage.updateScene(shotId, { status });
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

      if (!await canAccessProject(projectId, req.user!.id)) {
        return mcpError(res, "Forbidden", "FORBIDDEN", 403);
      }

      const comment = await storage.createComment({
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
      const { projectId, filename, fileData: rawFileData, metadata } = schema.parse(req.body);
      if (rawFileData.length > 14 * 1024 * 1024) {
        return mcpError(res, "File too large (max 10MB)", "PAYLOAD_TOO_LARGE", 413);
      }
      // Assets are stored as data: URLs everywhere else (the UI renders/downloads them as-is); MCP
      // clients send bare base64, so wrap it.
      const fileData = rawFileData.startsWith("data:") ? rawFileData : `data:application/octet-stream;base64,${rawFileData}`;

      if (!await canEditProject(projectId, req.user!.id)) {
        return mcpError(res, "Forbidden", "FORBIDDEN", 403);
      }

      const asset = await storage.createAsset({
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

      if (!await canAccessProject(projectId, req.user!.id)) {
        return mcpError(res, "Forbidden", "FORBIDDEN", 403);
      }

      const { items: assets } = await storage.listAssets(projectId, type, { limit: 200 });
      res.json({ assets });
    } catch (e: any) {
      mcpError(res, e.message, "INVALID_REQUEST");
    }
  });
}
