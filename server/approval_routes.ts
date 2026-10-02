import { requireAuth, canAccessProject } from "./auth";
import type { Express, Request, Response, NextFunction } from "express";
import { db, storage } from "./storage";
import { eq } from "drizzle-orm";
import { approval_signoffs } from "../shared/approval_schema";
import { z } from "zod";
import { createHash } from "node:crypto";
import { notifyDiscord } from "./discord";

const MILESTONES = ["storyboard", "animatic", "final"] as const;

async function ensureDefaultRows(projectId: number): Promise<void> {
  const existing = await db
    .select()
    .from(approval_signoffs)
    .where(eq(approval_signoffs.projectId, projectId))
    ;

  if (existing.length === 0) {
    const now = new Date();
    for (const milestone of MILESTONES) {
      await db.insert(approval_signoffs)
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
        ;
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
    if (!(await canAccessProject(projectId, (req as any).user.id))) {
      return res.status(403).json({ message: "No access" });
    }
    await ensureDefaultRows(projectId);
    const rows = await db
      .select()
      .from(approval_signoffs)
      .where(eq(approval_signoffs.projectId, projectId))
      ;
    res.json(rows);
  });

  // PUT /api/approvals/:id — update status/signature/notes/approverName/approvedAt
  app.put("/api/approvals/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const row = await db
      .select()
      .from(approval_signoffs)
      .where(eq(approval_signoffs.id, id))
      .then((r) => r[0]);
    if (!row) return res.status(404).json({ message: "Not found" });
    if (!(await canAccessProject(row.projectId, (req as any).user.id))) {
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

    const updated = await db
      .update(approval_signoffs)
      .set(normalized as any)
      .where(eq(approval_signoffs.id, id))
      .returning()
      .then((r) => r[0]);

    if (patch.status && updated) {
      notifyDiscord(row.projectId, `Milestone ${row.milestone} Status Update`, `Status for **${row.milestone}** is now **${patch.status}**${patch.approverName ? ` (by ${patch.approverName})` : ""}`);
    }

    res.json(updated);
  });
}
