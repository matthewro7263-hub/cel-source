import type { Express, Request, Response, NextFunction } from "express";
import { storage, getSessionUser, db } from "./storage";
import { insertChallengeSubmissionSchema } from "../shared/challenge_schema";
import {
  challenge_prompts,
  challenge_reactions,
  challenge_submissions,
} from "../shared/challenge_schema";
import { challenge_leaderboard_snapshots } from "../shared/challenge_leaderboard_schema";
import { getLiveLeaderboard, snapshotWeekLeaderboard } from "./leaderboard_cron";
import { eq, asc, desc, and } from "drizzle-orm";
import { z } from "zod";

// ─── local auth helpers ───────────────────────────────────────────────────────
// Mirror the pattern from biz_routes.ts / routes.ts exactly.

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
    const prompts = await (storage as any).listChallengePrompts();
    res.json(prompts);
  });

  // Authed — only the logged-in user's own submissions.
  app.get("/api/challenges/submissions", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const submissions = await (storage as any).listChallengeSubmissions(userId);
    res.json(submissions);
  });

  app.get("/api/challenges/feed", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    res.json(await (storage as any).listChallengeFeed(userId));
  });

  // Authed — submissions are always written under the authed user.
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
}
