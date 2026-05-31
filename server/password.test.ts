import { test, expect, describe, mock } from "bun:test";
import { scryptSync } from "node:crypto";

// Mock database dependencies to avoid trying to connect to a real database during tests
mock.module("@neondatabase/serverless", () => ({
  Pool: class { constructor() {} },
  neonConfig: { webSocketConstructor: null }
}));

mock.module("drizzle-orm/neon-serverless", () => ({
  drizzle: () => ({})
}));

// Set required env variables before importing to satisfy validation in storage.ts
process.env.DATABASE_URL = "postgres://mock:mock@mock/mock";

describe("Password Utilities", async () => {
  // Import after setting up mocks
  const { hashPassword, verifyPassword } = await import("./storage.ts");

  test("hashPassword generates a valid v2 hash", () => {
    const password = "mySuperSecretPassword123!";
    const hash = hashPassword(password);

    expect(hash.startsWith("v2:")).toBe(true);
    expect(hash.split(":")).toHaveLength(3);
  });

  test("verifyPassword correctly verifies a valid v2 hash", () => {
    const password = "mySuperSecretPassword123!";
    const hash = hashPassword(password);

    expect(verifyPassword(password, hash)).toBe(true);
  });

  test("verifyPassword rejects an invalid password for v2 hash", () => {
    const password = "mySuperSecretPassword123!";
    const hash = hashPassword(password);

    expect(verifyPassword("wrongPassword", hash)).toBe(false);
  });

  test("verifyPassword correctly verifies a valid legacy hash (2 parts)", () => {
    const password = "mySuperSecretPassword123!";
    const salt = "abcdef123456";
    // Legacy hashes use the default scrypt params (no custom N, r, p maxmem passed)
    const hash = scryptSync(password, salt, 64).toString("hex");
    const legacyStored = `${salt}:${hash}`;

    expect(verifyPassword(password, legacyStored)).toBe(true);
  });

  test("verifyPassword rejects an invalid password for legacy hash", () => {
    const password = "mySuperSecretPassword123!";
    const salt = "abcdef123456";
    const hash = scryptSync(password, salt, 64).toString("hex");
    const legacyStored = `${salt}:${hash}`;

    expect(verifyPassword("wrongPassword", legacyStored)).toBe(false);
  });

  test("verifyPassword handles invalid hash formats gracefully", () => {
    const password = "mySuperSecretPassword123!";

    expect(verifyPassword(password, "invalid_format_string")).toBe(false);
    expect(verifyPassword(password, "v2:salt_but_no_hash")).toBe(false);
    expect(verifyPassword(password, "v3:salt:hash")).toBe(false);
  });
});
