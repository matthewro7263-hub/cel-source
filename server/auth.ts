// Shared authentication + project-access helpers.
// Every route module must use these so session revocation (tokenVersion) and
// the access cache behave identically everywhere.

import type { Request, Response, NextFunction } from "express";
import { storage, getSessionPayload } from "./storage";

/** Extract bearer token from the Authorization header. */
export function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth) return undefined;
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return undefined;
}

export type AuthResult =
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof storage.getUser>>> }
  | { ok: false; reason: "unauthenticated" | "user_not_found" | "revoked" };

/** Validate a raw session token: signature, expiry, user existence and tokenVersion. */
export async function authenticateToken(token: string | undefined): Promise<AuthResult> {
  const session = getSessionPayload(token);
  if (!session) return { ok: false, reason: "unauthenticated" };
  const user = await storage.getUser(session.userId);
  if (!user) return { ok: false, reason: "user_not_found" };
  if (session.tokenVersion !== user.tokenVersion) return { ok: false, reason: "revoked" };
  return { ok: true, user };
}

const REASON_MESSAGE = {
  unauthenticated: "Not authenticated",
  user_not_found: "User not found",
  revoked: "Session revoked",
} as const;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authenticateToken(extractToken(req));
    if (!result.ok) return res.status(401).json({ message: REASON_MESSAGE[result.reason] });
    req.user = result.user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Attach req.user when a valid token is present; never rejects. */
export async function attachOptionalUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const result = await authenticateToken(extractToken(req));
    if (result.ok) req.user = result.user;
  } catch (err) {
    console.error("[auth] optional auth failed:", err);
  }
  next();
}

// ===== Project access (with a short-lived cache) =====
const ACCESS_CACHE_TTL_MS = 60_000;
const accessCache = new Map<string, { allowed: boolean; expiresAt: number }>();

function pruneAccessCache(now = Date.now()) {
  for (const [key, entry] of accessCache) {
    if (now >= entry.expiresAt) accessCache.delete(key);
  }
}

export function invalidateProjectAccess(projectId: number, userId?: number) {
  if (userId !== undefined) {
    accessCache.delete(`${projectId}:${userId}`);
    return;
  }
  const prefix = `${projectId}:`;
  for (const key of accessCache.keys()) {
    if (key.startsWith(prefix)) accessCache.delete(key);
  }
}

export async function canAccessProject(projectId: number, userId: number): Promise<boolean> {
  pruneAccessCache();
  const key = `${projectId}:${userId}`;
  const cached = accessCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.allowed;

  const p = await storage.getProject(projectId);
  const allowed = !!p && (p.ownerId === userId || (await storage.isMember(projectId, userId)));
  accessCache.set(key, { allowed, expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
  return allowed;
}

// ===== Admin gate =====
// Admins are listed in CEL_ADMIN_EMAILS (comma-separated). With no list configured
// nobody is an admin, so admin-only endpoints fail closed.
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const admins = (process.env.CEL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (!isAdminEmail(req.user?.email)) return res.status(403).json({ message: "Admin only" });
    next();
  });
}
