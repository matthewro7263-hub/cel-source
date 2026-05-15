import type { Express, Request, Response, NextFunction } from "express";
import { db, getSessionUser, storage } from "./storage";
import { eq } from "drizzle-orm";
import { approval_signoffs } from "../shared/approval_schema";
import { z } from "zod";
import { createHash } from "node:crypto";
import { notifyDiscord } from "./discord";

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

const MILESTONES = ["storyboard", "animatic", "final"] as const;

function ensureDefaultRows(projectId: number): void {
  const existing = db
    .select()
    .from(approval_signoffs)
    .where(eq(approval_signoffs.projectId, projectId))
    .all();

  if (existing.length === 0) {
    const now = new Date().toISOString();
    for (const milestone of MILESTONES) {
      db.insert(approval_signoffs)
        .values({
          projectId,
          milestone,
          status: "pending",
          approverName: null,
          signature: null,
          notes: null,
          approvedAt: null,
          createdAt: now,
        })
        .run();
    }
  }
}

const approvalPutSchema = z.object({
  status: z.enum(["pending", "approved", "changes-requested"]).optional(),
  approverName: z.string().nullable().optional(),
  signature: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
});

function normalizeOptional(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildSignatureHash(args: {
  projectId: number;
  milestone: string;
  signature: string;
  approvedAt: string;
}): string {
  return createHash("sha256")
    .update(`${args.projectId}|${args.milestone}|${args.signature}|${args.approvedAt}`)
    .digest("hex")
    .slice(0, 20)
    .toUpperCase();
}

export function registerApprovalRoutes(app: Express) {
  // GET /api/projects/:id/approvals — list, auto-create 3 defaults if none
  app.get("/api/projects/:id/approvals", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    if (!canAccessProject(projectId, (req as any).user.id)) {
      return res.status(403).json({ message: "No access" });
    }
    ensureDefaultRows(projectId);
    const rows = db
      .select()
      .from(approval_signoffs)
      .where(eq(approval_signoffs.projectId, projectId))
      .all();
    res.json(rows);
  });

  // PUT /api/approvals/:id — update status/signature/notes/approverName/approvedAt
  app.put("/api/approvals/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const row = db
      .select()
      .from(approval_signoffs)
      .where(eq(approval_signoffs.id, id))
      .get();
    if (!row) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(row.projectId, (req as any).user.id)) {
      return res.status(403).json({ message: "No access" });
    }
    let patch: z.infer<typeof approvalPutSchema>;
    try {
      patch = approvalPutSchema.parse(req.body);
    } catch (e: any) {
      return res.status(400).json({ message: e.message });
    }
    const normalized: Record<string, unknown> = {};
    if (patch.status !== undefined) normalized.status = patch.status;
    if (patch.approverName !== undefined) normalized.approverName = normalizeOptional(patch.approverName);
    if (patch.signature !== undefined) normalized.signature = normalizeOptional(patch.signature);
    if (patch.notes !== undefined) normalized.notes = normalizeOptional(patch.notes);
    if (patch.approvedAt !== undefined) normalized.approvedAt = patch.approvedAt;

    if (patch.status === "approved") {
      const signature = normalizeOptional(patch.signature);
      if (!signature) {
        return res.status(400).json({ message: "Typed signature is required for approval" });
      }
      const approvedAt = new Date().toISOString();
      normalized.signature = signature;
      normalized.approvedAt = approvedAt;
      normalized.signatureHash = buildSignatureHash({
        projectId: row.projectId,
        milestone: row.milestone,
        signature,
        approvedAt,
      });
    } else if (patch.status) {
      normalized.approvedAt = null;
      normalized.signatureHash = null;
    }

    const updated = db
      .update(approval_signoffs)
      .set(normalized as any)
      .where(eq(approval_signoffs.id, id))
      .returning()
      .get();

    if (patch.status && updated) {
      notifyDiscord(row.projectId, `Milestone ${row.milestone} Status Update`, `Status for **${row.milestone}** is now **${patch.status}**${patch.approverName ? ` (by ${patch.approverName})` : ""}`);
    }

    res.json(updated);
  });
}
