import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { describeZodIssues, installFriendlyZodMessages } from "./errors";

installFriendlyZodMessages();

describe("friendly zod messages", () => {
  const schema = z.object({ title: z.string().min(1), budget: z.enum(["a", "b"]), n: z.number() });

  test("ZodError#message is readable, not a JSON dump", () => {
    const res = schema.safeParse({ title: "", budget: "c", n: "x" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.message).not.toContain("[");
      expect(res.error.message).toContain("title:");
      expect(res.error.message).toContain("budget:");
    }
  });

  test("thrown parse errors carry the readable message", () => {
    expect(() => schema.parse({})).toThrow(/title: Required/);
  });

  test("caps the number of issues listed", () => {
    const issues = schema.safeParse({}).error!.issues;
    expect(describeZodIssues(issues, 1)).toMatch(/\(\+2 more\)$/);
  });
});
