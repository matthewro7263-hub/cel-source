import { describe, expect, test, mock } from "bun:test";

// Mock dependencies that cause issues in tests
mock.module("@neondatabase/serverless", () => ({
  Pool: class { constructor() {} },
  neonConfig: {}
}));
mock.module("drizzle-orm/neon-serverless", () => ({
  drizzle: () => ({})
}));
mock.module("ws", () => ({
  default: class { constructor() {} }
}));

// Set required environment variable for module loading
process.env.DATABASE_URL = "postgres://dummy:dummy@localhost:5432/dummy";

// Use dynamic import so mocks are applied
const { genToken } = await import("./storage.ts");

describe("genToken", () => {
  test("generates a token of the default length", () => {
    const token = genToken();
    expect(token).toHaveLength(16);
    expect(typeof token).toBe("string");
  });

  test("generates a token of the specified length", () => {
    const token = genToken(32);
    expect(token).toHaveLength(32);
  });

  test("generates a valid hex string", () => {
    const token = genToken();
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  test("generates unique tokens", () => {
    const token1 = genToken();
    const token2 = genToken();
    expect(token1).not.toBe(token2);
  });

  test("handles length 0", () => {
    const token = genToken(0);
    expect(token).toBe("");
  });
});
