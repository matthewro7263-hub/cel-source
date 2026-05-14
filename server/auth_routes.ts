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
// NOTE: argon2 must be installed: pnpm add argon2
//       (express-session and passport are already in package.json)

import { Router, type Request, type Response, type NextFunction } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import argon2 from "argon2";
import { z } from "zod";
import { eq } from "drizzle-orm";

// db is exported from storage.ts — do NOT import from a non-existent ./db
import { db } from "./storage";
import { users, type User } from "../shared/schema";

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
        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok) return done(null, false, { message: "invalid_credentials" });
        return done(null, { id: user.id, email: user.email, displayName: user.name });
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
      done(null, { id: u.id, email: u.email, displayName: u.name });
    } catch (err) {
      done(err as Error);
    }
  });
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user?.id) return res.status(401).json({ error: "unauthorized" });
  next();
}

authRouter.post("/register", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  const { email, password, displayName } = parsed.data;
  const normEmail = email.toLowerCase();
  try {
    const existing = await db.select().from(users).where(eq(users.email, normEmail)).limit(1);
    if (existing[0]) return res.status(409).json({ error: "email_taken" });
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const name = displayName ?? normEmail.split("@")[0];
    const inserted = await db.insert(users).values({ email: normEmail, passwordHash, name }).returning();
    const u = inserted[0] as User;
    // Auto-login after register:
    (req as any).login({ id: u.id, email: u.email, displayName: u.name }, (err: any) => {
      if (err) return res.status(500).json({ error: "login_failed" });
      res.status(201).json({ id: u.id, email: u.email, displayName: u.name });
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "register_failed" });
  }
});

authRouter.post("/login", (req, res, next) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message ?? "invalid_credentials" });
    (req as any).login(user, (e: any) => {
      if (e) return next(e);
      res.json({ id: user.id, email: user.email, displayName: user.displayName });
    });
  })(req, res, next);
});

authRouter.post("/logout", (req, res, next) => {
  (req as any).logout?.((err: any) => {
    if (err) return next(err);
    (req as any).session?.destroy?.(() => res.json({ ok: true }));
  });
});

authRouter.get("/me", (req, res) => {
  const u = (req as any).user;
  if (!u) return res.status(401).json({ error: "unauthorized" });
  res.json(u);
});

export default authRouter;
