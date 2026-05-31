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

// ─── route registration ───────────────────────────────────────────────────────

export function registerChallengeRoutes(app: Express) {
  // ── EXISTING ROUTES (unchanged) ──────────────────────────────────────────

  // Public — anyone can browse the prompt list (no user data here).
  app.get("/api/challenges/prompts", async (req, res) => {
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
    const submission = await (storage as any).createChallengeSubmission({
      ...body,
      userId,
    });
    res.json(submission);
  });

  app.post(
    "/api/challenges/submissions/:id/reactions",
    requireAuth,
    async (req, res) => {
      const userId = (req as any).user.id;
      const submissionId = parseInt(String(req.params.id), 10);
      const body = z
        .object({ sticker: z.enum(["spark", "heart", "study", "wow"]) })
        .parse(req.body);
      try {
        const result = await (storage as any).toggleChallengeReaction(
          submissionId,
          userId,
          body.sticker
        );
        res.json(result);
      } catch (error: any) {
        res
          .status(404)
          .json({ message: error.message || "Submission not found" });
      }
    }
  );

  // ── NEW: LEADERBOARD ROUTES ───────────────────────────────────────────────

  /**
   * GET /api/challenges/leaderboard?week=<n>&limit=<n>
   *
   * Live leaderboard for the given week.  Hits challenge_reactions directly
   * so the board is always current.  Public — no auth required.
   *
   * Query params:
   *   week   (required) ISO week number, e.g. 20
   *   limit  max rows to return, 1–50, default 10
   *
   * Response: LiveLeaderboardRow[]
   *   { submissionId, userId, imageUrl, notes, totalReactions }
   */
  app.get("/api/challenges/leaderboard", async (req, res) => {
    const weekSchema = z.object({
      week: z
        .string()
        .regex(/^\d{1,3}$/, "week must be a positive integer")
        .transform(Number),
      limit: z
        .string()
        .regex(/^\d{1,3}$/)
        .optional()
        .default("10")
        .transform(Number),
    });

    let params: { week: number; limit: number };
    try {
      params = weekSchema.parse(req.query);
    } catch (e: any) {
      return res.status(400).json({ message: e.errors?.[0]?.message ?? "Invalid query params" });
    }

    const limit = Math.min(Math.max(params.limit, 1), 50);
    try {
      const rows = await getLiveLeaderboard(params.week, limit);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/challenges/leaderboard/snapshot?week=<n>
   *
   * Returns the persisted ranked snapshot for a closed week (written by the
   * Sunday-night cron).  Returns [] when no snapshot exists yet.
   * Public — no auth required.
   *
   * Response: ChallengeLeaderboardSnapshot[]
   */
  app.get("/api/challenges/leaderboard/snapshot", async (req, res) => {
    const weekSchema = z.object({
      week: z
        .string()
        .regex(/^\d{1,3}$/, "week must be a positive integer")
        .transform(Number),
    });

    let params: { week: number };
    try {
      params = weekSchema.parse(req.query);
    } catch (e: any) {
      return res.status(400).json({ message: e.errors?.[0]?.message ?? "Invalid query params" });
    }

    try {
      // Return the most recent snapshot batch for this week (last cron run).
      // If the cron ran twice for the same week, snapshotAt differs; we pick
      // the latest run so callers always see the most recent ranking.
      const latestRun = await db
        .select({ snapshotAt: challenge_leaderboard_snapshots.snapshotAt })
        .from(challenge_leaderboard_snapshots)
        .where(
          eq(challenge_leaderboard_snapshots.weekNumber, params.week)
        )
        .orderBy(desc(challenge_leaderboard_snapshots.snapshotAt))
        .limit(1);

      if (latestRun.length === 0) {
        return res.json([]);
      }

      const latestAt = latestRun[0].snapshotAt;

      const rows = await db
        .select()
        .from(challenge_leaderboard_snapshots)
        .where(
          and(
            eq(challenge_leaderboard_snapshots.weekNumber, params.week),
            eq(challenge_leaderboard_snapshots.snapshotAt, latestAt)
          )
        )
        .orderBy(asc(challenge_leaderboard_snapshots.rank));

      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * POST /api/challenges/leaderboard/snapshot
   *
   * Manually trigger a snapshot for a given week.  Restricted to authed
   * users (use this from a Render cron job or admin panel).
   *
   * Body: { week: number }
   * Response: { ok: true, week: number, rows: number }
   */
  app.post(
    "/api/challenges/leaderboard/snapshot",
    requireAuth,
    async (req, res) => {
      const schema = z.object({
        week: z.number().int().min(1).max(53),
      });

      let body: { week: number };
      try {
        body = schema.parse(req.body);
      } catch (e: any) {
        return res
          .status(400)
          .json({ message: e.errors?.[0]?.message ?? "Invalid body" });
      }

      try {
        await snapshotWeekLeaderboard(body.week);
        // Count how many rows were written
        const latestRun = await db
          .select({ snapshotAt: challenge_leaderboard_snapshots.snapshotAt })
          .from(challenge_leaderboard_snapshots)
          .where(eq(challenge_leaderboard_snapshots.weekNumber, body.week))
          .orderBy(desc(challenge_leaderboard_snapshots.snapshotAt))
          .limit(1);

        const n =
          latestRun.length > 0
            ? (
                await db
                  .select()
                  .from(challenge_leaderboard_snapshots)
                  .where(
                    and(
                      eq(
                        challenge_leaderboard_snapshots.weekNumber,
                        body.week
                      ),
                      eq(
                        challenge_leaderboard_snapshots.snapshotAt,
                        latestRun[0].snapshotAt
                      )
                    )
                  )
              ).length
            : 0;

        res.json({ ok: true, week: body.week, rows: n });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    }
  );

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
