import type { Express, Request, Response, NextFunction } from "express";
import { storage, getSessionUser, db } from "./storage";
import {
  insertChallengePromptSchema,
  insertChallengeSubmissionSchema,
  challenge_submissions,
  challenge_prompts,
} from "../shared/challenge_schema";
import { eq, countDistinct } from "drizzle-orm";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Local auth helpers — mirror the pattern used in biz_routes.ts.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Speedrun deadline helper
// ---------------------------------------------------------------------------

/** Returns the UTC Date at which a speedrun prompt's window closes. */
function speedrunDeadline(prompt: { createdAt: Date; deadlineHours: number | null }): Date | null {
  if (!prompt.deadlineHours) return null;
  return new Date(prompt.createdAt.getTime() + prompt.deadlineHours * 60 * 60 * 1000);
}

export function registerChallengeRoutes(app: Express) {
  // ── Public: anyone can browse prompt list ──────────────────────────────────
  app.get("/api/challenges/prompts", async (_req, res) => {
    const prompts = await (storage as any).listChallengePrompts();
    res.json(prompts);
  });

  // ── Authed: the logged-in user's own submissions ───────────────────────────
  app.get("/api/challenges/submissions", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const submissions = await (storage as any).listChallengeSubmissions(userId);
    res.json(submissions);
  });

  app.get("/api/challenges/feed", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    res.json(await (storage as any).listChallengeFeed(userId));
  });

  // ── Authed: create submission (with speedrun deadline guard) ───────────────
  app.post("/api/challenges/submissions", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const body = insertChallengeSubmissionSchema.parse(req.body);

    // Speedrun deadline check
    const prompt = await db
      .select()
      .from(challenge_prompts)
      .where(eq(challenge_prompts.id, body.promptId))
      .then((r) => r[0]);

    if (!prompt) {
      return res.status(404).json({ message: "Prompt not found" });
    }

    if (prompt.isSpeedrun) {
      const deadline = speedrunDeadline(prompt);
      if (deadline && Date.now() > deadline.getTime()) {
        return res.status(409).json({
          message: "Speedrun window closed",
          closedAt: deadline.toISOString(),
        });
      }
    }

    const submission = await (storage as any).createChallengeSubmission({ ...body, userId });
    res.json(submission);
  });

  // ── Authed: reactions ──────────────────────────────────────────────────────
  app.post("/api/challenges/submissions/:id/reactions", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const submissionId = parseInt(String(req.params.id), 10);
    const body = z
      .object({ sticker: z.enum(["spark", "heart", "study", "wow"]) })
      .parse(req.body);
    try {
      const result = await (storage as any).toggleChallengeReaction(
        submissionId,
        userId,
        body.sticker,
      );
      res.json(result);
    } catch (error: any) {
      res.status(404).json({ message: error.message || "Submission not found" });
    }
  });

  // ── Authed (admin): create a new prompt (including speedrun) ───────────────
  app.post("/api/challenges/prompts", requireAuth, async (req, res) => {
    const body = insertChallengePromptSchema.parse(req.body);
    const prompt = await db
      .insert(challenge_prompts)
      .values({ ...body, createdAt: new Date() })
      .returning()
      .then((r) => r[0]);
    res.status(201).json(prompt);
  });

  // ── Public: participant count for a single prompt ─────────────────────────
  // Used by the 30-second polling hook on the challenge card.
  app.get("/api/challenges/prompts/:id/participants", async (req, res) => {
    const promptId = parseInt(String(req.params.id), 10);
    if (isNaN(promptId)) {
      return res.status(400).json({ message: "Invalid prompt id" });
    }
    // countDistinct is Drizzle 0.29+ — falls back gracefully if not available
    const rows = await db
      .selectDistinct({ userId: challenge_submissions.userId })
      .from(challenge_submissions)
      .where(eq(challenge_submissions.promptId, promptId));
    res.json({ count: rows.length });
  });
}
