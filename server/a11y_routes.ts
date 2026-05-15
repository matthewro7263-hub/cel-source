import type { Express, NextFunction, Request, Response } from "express";
import { getSessionUser, storage } from "./storage";
import { insertA11yPrefsSchema } from "../shared/a11y_schema";

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth) return undefined;
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return undefined;
}

async function attachOptionalUser(req: Request, _res: Response, next: NextFunction) {
  const userId = getSessionUser(extractToken(req));
  if (userId) {
    const user = await storage.getUser(userId);
    if (user) (req as any).user = user;
  }
  next();
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  attachOptionalUser(req, res, () => {
    if (!(req as any).user) return res.status(401).json({ error: "unauthorized" });
    next();
  });
}

export function registerA11yRoutes(app: Express) {
  app.get("/api/a11y/prefs", attachOptionalUser, async (req, res) => {
    // Auth-aware: only return saved prefs if we have a real authed user. For
    // unauthenticated visitors (landing page, share links) return all-zero
    // defaults so we never leak one user's accessibility prefs to others.
    // Previously this returned user 1's prefs for everyone, which caused the
    // public landing page to render in Comic Sans whenever the demo user had
    // dyslexia mode on.
    const authedUserId = (req as any).user?.id;
    if (!authedUserId) {
      return res.json({ userId: 0, focusMode: 0, dyslexia: 0, colorblind: 0, reducedMotion: 0, largeTouch: 0, audioCues: 0 });
    }
    let prefs = await (storage as any).getA11yPrefs(authedUserId);
    if (!prefs) {
      prefs = await (storage as any).createA11yPrefs({ userId: authedUserId, focusMode: 0, dyslexia: 0, colorblind: 0, reducedMotion: 0, largeTouch: 0, audioCues: 0 });
    }
    res.json(prefs);
  });

  app.post("/api/a11y/prefs", requireAuth, async (req, res) => {
    // Mutation requires a real authed user — anonymous visitors can't write
    // anyone's preferences.
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "unauthorized" });
    const body = insertA11yPrefsSchema.parse({ ...req.body, userId });
    const prefs = await (storage as any).updateA11yPrefs(userId, body);
    res.json(prefs);
  });
}
