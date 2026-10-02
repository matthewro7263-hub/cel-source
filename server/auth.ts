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
// Roles: owner (ownerId) > editor > reviewer. Reviewers can read and take part in review (comments, pins,
// sign-off, feedback) but not change production content, see canEditProject.
export type ProjectRole = "owner" | "editor" | "reviewer";
const ACCESS_CACHE_TTL_MS = 60_000;
const roleCache = new Map<string, { role: ProjectRole | null; expiresAt: number }>();

function pruneRoleCache(now = Date.now()) {
  for (const [key, entry] of roleCache) {
    if (now >= entry.expiresAt) roleCache.delete(key);
  }
}

export function invalidateProjectAccess(projectId: number, userId?: number) {
  if (userId !== undefined) {
    roleCache.delete(`${projectId}:${userId}`);
    return;
  }
  const prefix = `${projectId}:`;
  for (const key of roleCache.keys()) {
    if (key.startsWith(prefix)) roleCache.delete(key);
  }
}

export async function getProjectRole(projectId: number, userId: number): Promise<ProjectRole | null> {
  pruneRoleCache();
  const key = `${projectId}:${userId}`;
  const cached = roleCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.role;

  const project = await storage.getProject(projectId);
  let role: ProjectRole | null = null;
  if (project) {
    if (project.ownerId === userId) role = "owner";
    else {
      const memberRole = await storage.getMemberRole(projectId, userId);
      if (memberRole !== undefined) role = memberRole === "reviewer" ? "reviewer" : "editor";
    }
  }
  roleCache.set(key, { role, expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
  return role;
}

/** Any member (owner, editor or reviewer): may read the project. */
export async function canAccessProject(projectId: number, userId: number): Promise<boolean> {
  return (await getProjectRole(projectId, userId)) !== null;
}

/** Owner or editor: may change production content. Reviewers are read/comment only. */
export async function canEditProject(projectId: number, userId: number): Promise<boolean> {
  const role = await getProjectRole(projectId, userId);
  return role === "owner" || role === "editor";
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
