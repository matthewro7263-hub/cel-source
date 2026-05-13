// server/uploads_routes.ts
// Express router exposing R2-backed upload endpoints.
// Mount with: app.use("/api/uploads", uploadsRouter);
// Requires the request to be authenticated (req.user with .id).

import { Router, type Request, type Response, type NextFunction } from "express";
import { presignUpload, presignDownload, deleteObject, listUserObjects, isOwnedKey } from "./r2";

export const uploadsRouter = Router();

// Adjust this guard to match however auth is wired in this project.
function requireUser(req: Request, res: Response, next: NextFunction) {
  const user: any = (req as any).user;
  if (!user || !user.id) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB soft cap (enforce client-side)
const ALLOWED_PREFIX = /^[a-zA-Z0-9_\-]{1,32}$/;

uploadsRouter.post("/presign", requireUser, async (req, res) => {
  try {
    const { filename, contentType, prefix } = req.body ?? {};
    if (typeof filename !== "string" || typeof contentType !== "string") {
      return res.status(400).json({ error: "filename and contentType required" });
    }
    if (prefix && !ALLOWED_PREFIX.test(prefix)) {
      return res.status(400).json({ error: "invalid prefix" });
    }
    const userId = (req as any).user.id as string;
    const data = await presignUpload({ userId, filename, contentType, prefix, maxBytes: MAX_BYTES });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "presign_failed" });
  }
});

uploadsRouter.get("/download", requireUser, async (req, res) => {
  try {
    const key = String(req.query.key ?? "");
    const userId = (req as any).user.id as string;
    if (!key || !isOwnedKey(userId, key)) return res.status(404).json({ error: "not_found" });
    const url = await presignDownload(key, 300);
    res.json({ url, expiresIn: 300 });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "download_failed" });
  }
});

uploadsRouter.delete("/object", requireUser, async (req, res) => {
  try {
    const key = String(req.query.key ?? "");
    const userId = (req as any).user.id as string;
    if (!key || !isOwnedKey(userId, key)) return res.status(404).json({ error: "not_found" });
    await deleteObject(key);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "delete_failed" });
  }
});

uploadsRouter.get("/list", requireUser, async (req, res) => {
  try {
    const userId = (req as any).user.id as string;
    const prefix = typeof req.query.prefix === "string" ? req.query.prefix : undefined;
    if (prefix && !ALLOWED_PREFIX.test(prefix)) return res.status(400).json({ error: "invalid prefix" });
    const out = await listUserObjects(userId, prefix);
    const items = (out.Contents ?? []).map((o) => ({ key: o.Key!, size: o.Size, modified: o.LastModified }));
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "list_failed" });
  }
});

export default uploadsRouter;
