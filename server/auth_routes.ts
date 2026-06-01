// server/auth_routes.ts
// Account auth routes using Passport-local + express-session.
// Assumes you'll wire passport.serializeUser/deserializeUser and the LocalStrategy
// somewhere central (e.g. server/index.ts) using the helpers below.
//
// Endpoints:
//   POST /api/auth/register  { email, password, displayName? }
//   POST /api/auth/login     { email, password }
//   POST /api/auth/logout
//   GET  /api/auth/me
//
// NOTE: express-session and passport need to be wired by the caller before
// mounting this router.

import { Router, type Request, type Response, type NextFunction } from "express";
import "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { z } from "zod";
import { eq } from "drizzle-orm";

// db is exported from await storage.ts — do NOT import from a non-existent ./db
import { db, hashPassword, verifyPassword } from "./storage";
import { users, type User } from "../shared/schema";
import { checkAchievements } from "./achievements";

export const authRouter = Router();

const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(80).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function configurePassport() {
  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const found = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
        const user = found[0];
        if (!user) return done(null, false, { message: "invalid_credentials" });
        const ok = verifyPassword(password, user.passwordHash);
        if (!ok) return done(null, false, { message: "invalid_credentials" });
        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    })
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const found = await db.select().from(users).where(eq(users.id, id)).limit(1);
      const u = found[0];
      if (!u) return done(null, false);
      done(null, u);
    } catch (err) {
      done(err as Error);
    }
  });
}

import rateLimit from "express-rate-limit";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "too_many_requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.id) return res.status(401).json({ error: "unauthorized" });
  next();
}

authRouter.post("/register", authLimiter, async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  const { email, password, displayName } = parsed.data;
  const normEmail = email.toLowerCase();
  try {
    const existing = await db.select().from(users).where(eq(users.email, normEmail)).limit(1);
    if (existing[0]) return res.status(409).json({ error: "email_taken" });
    const passwordHash = hashPassword(password);
    const name = displayName ?? normEmail.split("@")[0];
    const inserted = await db.insert(users).values({ email: normEmail, passwordHash, name }).returning();
    const u = inserted[0] as User;
    // Auto-login after register:
    req.login(u, async (err: any) => {
      if (err) return res.status(500).json({ error: "login_failed" });
      await checkAchievements({ userId: u.id, event: "login" }).catch(e => console.error(e));
      res.status(201).json({ id: u.id, email: u.email, name: u.name });
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "register_failed" });
  }
});

authRouter.post("/login", authLimiter, (req, res, next) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message ?? "invalid_credentials" });
    req.login(user, async (e: any) => {
      if (e) return next(e);
      await checkAchievements({ userId: user.id, event: "login" }).catch(err => console.error(err));
      res.json({ id: user.id, email: user.email, name: user.name });
    });
  })(req, res, next);
});

authRouter.post("/logout", (req, res, next) => {
  req.logout((err: any) => {
    if (err) return next(err);
    req.session?.destroy(() => res.json({ ok: true }));
  });
});

authRouter.get("/me", (req, res) => {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "unauthorized" });
  res.json(u);
});

export default authRouter;
