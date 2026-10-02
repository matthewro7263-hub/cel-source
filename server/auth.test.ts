import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("@neondatabase/serverless", () => ({
  Pool: class { constructor() {} },
  neonConfig: {},
}));
mock.module("drizzle-orm/neon-serverless", () => ({ drizzle: () => ({}) }));
mock.module("ws", () => ({ default: class { constructor() {} } }));

const { storage, createSession } = await import("./storage.ts");
const { authenticateToken, canAccessProject, canEditProject, invalidateProjectAccess, isAdminEmail, requireAdmin } =
  await import("./auth.ts");

const s = storage as any;
let calls = 0;

beforeEach(() => {
  calls = 0;
  s.getUser = async (id: number) => (id === 1 ? { id: 1, email: "a@x.com", tokenVersion: 3 } : undefined);
  s.getProject = async (id: number) => { calls++; return id === 10 ? { id: 10, ownerId: 1 } : undefined; };
  s.getMemberRole = async (_p: number, userId: number) => ({ 2: "editor", 4: "reviewer" } as Record<number, string>)[userId];
  invalidateProjectAccess(10);
});

describe("authenticateToken", () => {
  test("accepts a valid token", async () => {
    const r = await authenticateToken(createSession(1, 3));
    expect(r.ok).toBe(true);
  });
  test("rejects a revoked token (tokenVersion mismatch)", async () => {
    const r = await authenticateToken(createSession(1, 2));
    expect(r).toEqual({ ok: false, reason: "revoked" });
  });
  test("rejects unknown users, garbage and missing tokens", async () => {
    expect(await authenticateToken(createSession(99, 0))).toEqual({ ok: false, reason: "user_not_found" });
    expect(await authenticateToken("nope")).toEqual({ ok: false, reason: "unauthenticated" });
    expect(await authenticateToken(undefined)).toEqual({ ok: false, reason: "unauthenticated" });
  });
  test("rejects a tampered signature", async () => {
    const t = createSession(1, 3);
    const tampered = t.slice(0, -1) + (t.endsWith("0") ? "1" : "0");
    expect((await authenticateToken(tampered)).ok).toBe(false);
  });
});

describe("canAccessProject", () => {
  test("owner and members are allowed, others and missing projects are not", async () => {
    expect(await canAccessProject(10, 1)).toBe(true);
    expect(await canAccessProject(10, 2)).toBe(true);
    expect(await canAccessProject(10, 3)).toBe(false);
    expect(await canAccessProject(11, 1)).toBe(false);
  });
  test("reviewers can read but not edit; editors and owners can do both", async () => {
    expect(await canAccessProject(10, 4)).toBe(true);
    expect(await canEditProject(10, 4)).toBe(false);
    expect(await canEditProject(10, 2)).toBe(true);
    expect(await canEditProject(10, 1)).toBe(true);
    expect(await canEditProject(10, 3)).toBe(false);
  });
  test("caches results until invalidated", async () => {
    await canAccessProject(10, 1);
    await canAccessProject(10, 1);
    expect(calls).toBe(1);
    invalidateProjectAccess(10, 1);
    await canAccessProject(10, 1);
    expect(calls).toBe(2);
  });
});

describe("admin gate", () => {
  test("isAdminEmail fails closed without configuration", () => {
    delete process.env.CEL_ADMIN_EMAILS;
    expect(isAdminEmail("a@x.com")).toBe(false);
  });
  test("isAdminEmail matches case-insensitively", () => {
    process.env.CEL_ADMIN_EMAILS = " A@x.com , b@x.com";
    expect(isAdminEmail("a@X.com")).toBe(true);
    expect(isAdminEmail("c@x.com")).toBe(false);
    delete process.env.CEL_ADMIN_EMAILS;
  });
  test("requireAdmin returns 403 for non-admins", async () => {
    let status = 0;
    const res: any = { status(c: number) { status = c; return this; }, json() { return this; } };
    const req: any = { headers: { authorization: `Bearer ${createSession(1, 3)}` } };
    await requireAdmin(req, res, () => { status = 200; });
    expect(status).toBe(403);
  });
});

describe("signed media urls", () => {
  const { signedMediaUrl, verifySignedMedia } = require("./storage.ts");
  const parse = (url: string) => {
    const u = new URL(url, "http://x");
    return { id: Number(u.pathname.split("/").pop()), exp: Number(u.searchParams.get("exp")), sig: u.searchParams.get("sig")! };
  };
  test("round-trips and is stable within a bucket", () => {
    const a = signedMediaUrl("panel", 7);
    expect(a).toBe(signedMediaUrl("panel", 7));
    const { id, exp, sig } = parse(a);
    expect(verifySignedMedia("panel", id, exp, sig)).toBe(true);
  });
  test("rejects other ids, bad signatures and expired links", () => {
    const { id, exp, sig } = parse(signedMediaUrl("panel", 7));
    expect(verifySignedMedia("panel", id + 1, exp, sig)).toBe(false);
    expect(verifySignedMedia("panel", id, exp, "zz")).toBe(false);
    expect(verifySignedMedia("panel", id, exp, sig.replace(/^./, sig[0] === "0" ? "1" : "0"))).toBe(false);
    expect(verifySignedMedia("panel", id, Date.now() - 1, sig)).toBe(false);
  });
});
