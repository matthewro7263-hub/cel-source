import { describe, expect, test, afterEach } from "bun:test";
import { decrypt, encrypt } from "./crypto";

const original = { key: process.env.ENCRYPTION_KEY, env: process.env.NODE_ENV };
afterEach(() => {
  if (original.key === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = original.key;
  process.env.NODE_ENV = original.env;
});

describe("crypto", () => {
  test("round-trips with a hex key", () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    const enc = encrypt("sk-secret");
    expect(enc.split(":")).toHaveLength(3);
    expect(decrypt(enc)).toBe("sk-secret");
  });

  test("round-trips with a passphrase key (hashed)", () => {
    process.env.ENCRYPTION_KEY = "some passphrase";
    expect(decrypt(encrypt("hello"))).toBe("hello");
  });

  test("detects tampering", () => {
    process.env.ENCRYPTION_KEY = "b".repeat(64);
    const [iv, tag, data] = encrypt("hello").split(":");
    const flipped = (data[0] === "0" ? "1" : "0") + data.slice(1);
    expect(() => decrypt(`${iv}:${tag}:${flipped}`)).toThrow();
  });

  test("reads legacy base64 values", () => {
    process.env.ENCRYPTION_KEY = "c".repeat(64);
    expect(decrypt(Buffer.from("legacy").toString("base64"))).toBe("legacy");
  });

  test("requires a key in production", () => {
    delete process.env.ENCRYPTION_KEY;
    process.env.NODE_ENV = "production";
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
  });
});
