// server/uploads_routes.ts
// Express router exposing R2-backed upload endpoints.
// Mount with: app.use("/api/uploads", uploadsRouter);
// Requires the request to be authenticated (req.user with .id).

import { Router, type Request, type Response, type NextFunction } from "express";
import { presignUpload, presignDownload, deleteObject, listUserObjects, isOwnedKey, R2_BUCKET } from "./r2";
import type { User as AppUser } from "@shared/schema";
import multer from "multer";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const localUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB for HEIC conversion
});

declare global {
  namespace Express {
    interface User extends AppUser {}
  }
}


export const uploadsRouter = Router();

// Adjust this guard to match however auth is wired in this project.
function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
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
    const userId = req.user!.id.toString();
    const data = await presignUpload({ userId, filename, contentType, prefix, maxBytes: MAX_BYTES });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "presign_failed" });
  }
});

uploadsRouter.get("/download", requireUser, async (req, res) => {
  try {
    const key = String(req.query.key ?? "");
    const userId = req.user!.id.toString();
    if (!key || !isOwnedKey(userId, key)) return res.status(404).json({ error: "not_found" });
    const url = await presignDownload(key, 300);
    res.json({ url, expiresIn: 300 });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "download_failed" });
  }
});

uploadsRouter.get("/file", requireUser, async (req, res) => {
  try {
    const key = String(req.query.key ?? "");
    const userId = req.user!.id.toString();
    if (!key || !isOwnedKey(userId, key)) return res.status(404).json({ error: "not_found" });
    const url = await presignDownload(key, 300);
    res.redirect(url);
  } catch (err: any) {
    res.status(500).send(err?.message ?? "Failed to redirect to R2 file");
  }
});

uploadsRouter.delete("/object", requireUser, async (req, res) => {
  try {
    const key = String(req.query.key ?? "");
    const userId = req.user!.id.toString();
    if (!key || !isOwnedKey(userId, key)) return res.status(404).json({ error: "not_found" });
    await deleteObject(key);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "delete_failed" });
  }
});

uploadsRouter.get("/list", requireUser, async (req, res) => {
  try {
    const userId = req.user!.id.toString();
    const prefix = typeof req.query.prefix === "string" ? req.query.prefix : undefined;
    if (prefix && !ALLOWED_PREFIX.test(prefix)) return res.status(400).json({ error: "invalid prefix" });
    const out = await listUserObjects(userId, prefix);
    const items = (out.Contents ?? []).map((o) => ({ key: o.Key!, size: o.Size, modified: o.LastModified }));
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "list_failed" });
  }
});

uploadsRouter.post("/convert-heic", requireUser, localUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Convert HEIC buffer to WebP buffer using sharp
    const webpBuffer = await sharp(req.file.buffer)
      .webp({ quality: 80 })
      .toBuffer();

    // Import S3 client & PutObjectCommand
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    // Save under user's directory in R2
    const key = `uploads/${req.user!.id}/storyboards/${randomUUID()}-${Date.now()}.webp`;
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: "image/webp",
      Body: webpBuffer,
    }));

    res.json({ key });
  } catch (err: any) {
    console.error("HEIC conversion failed:", err);
    res.status(500).json({ error: err?.message ?? "conversion_failed" });
  }
});

export default uploadsRouter;
