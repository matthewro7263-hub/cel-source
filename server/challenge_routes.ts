import type { Express, Request, Response, NextFunction } from "express";
import { storage, getSessionUser } from "./storage";
import { insertChallengeSubmissionSchema } from "../shared/challenge_schema";
import { z } from "zod";

// Local auth helpers — mirror the pattern used in biz_routes.ts.
// This file previously had a `userId = (req as any).user?.id || 1` fallback,
// which meant unauthenticated visitors saw user 1's challenge submissions
// and could create new submissions under that user's account. The security
// review caught this before publishing — now both endpoints require a valid
// Bearer token.

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth) return undefined;
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return undefined;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const userId = getSessionUser(token);
  if (!userId) return res.status(401).json({ message: "Not authenticated" });
  const user = storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "User not found" });
  (req as any).user = user;
  next();
}

export function registerChallengeRoutes(app: Express) {
  // Public — anyone can browse the prompt list (no user data here).
  app.get("/api/challenges/prompts", (req, res) => {
    const prompts = (storage as any).listChallengePrompts();
    res.json(prompts);
  });

  // Authed — only the logged-in user's own submissions.
  app.get("/api/challenges/submissions", requireAuth, (req, res) => {
    const userId = (req as any).user.id;
    const submissions = (storage as any).listChallengeSubmissions(userId);
    res.json(submissions);
  });

  app.get("/api/challenges/feed", requireAuth, (req, res) => {
    const userId = (req as any).user.id;
    res.json((storage as any).listChallengeFeed(userId));
  });

  // Authed — submissions are always written under the authed user.
  app.post("/api/challenges/submissions", requireAuth, (req, res) => {
    const userId = (req as any).user.id;
    const body = insertChallengeSubmissionSchema.parse(req.body);
    const submission = (storage as any).createChallengeSubmission({ ...body, userId });
    res.json(submission);
  });

  app.post("/api/challenges/submissions/:id/reactions", requireAuth, (req, res) => {
    const userId = (req as any).user.id;
    const submissionId = parseInt(String(req.params.id), 10);
    const body = z.object({
      sticker: z.enum(["spark", "heart", "study", "wow"]),
    }).parse(req.body);
    try {
      const result = (storage as any).toggleChallengeReaction(submissionId, userId, body.sticker);
      res.json(result);
    } catch (error: any) {
      res.status(404).json({ message: error.message || "Submission not found" });
    }
  });
}
