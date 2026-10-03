import { describe, expect, test } from "bun:test";
import { mergeTags, normalizeTag, parseTagReply, rankSimilar, similarityScore, MAX_TAGS_PER_ASSET } from "./asset_tags";

const asset = (id: number, filename: string, tags = "", category = "Characters", mimeType = "image/png") => ({ id, filename, tags, category, mimeType });

describe("normalizeTag", () => {
  test("lowercases, strips punctuation and caps length", () => {
    expect(normalizeTag("  Blue Dog! ")).toBe("blue dog");
    expect(normalizeTag("x")).toBeNull();
    expect(normalizeTag(42)).toBeNull();
    expect(normalizeTag("a".repeat(60))!.length).toBe(24);
  });
});

describe("mergeTags", () => {
  test("keeps existing tags first and drops duplicates", () => {
    expect(mergeTags("hero, rig", ["Hero", "Cartoon", "rig", "!!"])).toBe("hero, rig, cartoon");
  });
  test("respects the per-asset cap", () => {
    const many = Array.from({ length: 30 }, (_, i) => `tag${i}`);
    expect(mergeTags("", many).split(", ")).toHaveLength(MAX_TAGS_PER_ASSET);
  });
});

describe("parseTagReply", () => {
  test("parses a JSON object, even wrapped in prose or code fences", () => {
    expect(parseTagReply('Sure!\n```json\n{"tags": ["Dog", "blue", "cartoon"]}\n```')).toEqual(["dog", "blue", "cartoon"]);
  });
  test("parses a bare array", () => {
    expect(parseTagReply('["forest", "night"]')).toEqual(["forest", "night"]);
  });
  test("falls back to comma / line separated text and strips list markers", () => {
    expect(parseTagReply("1. forest\n2. night, moonlight")).toEqual(["forest", "night", "moonlight"]);
  });
  test("caps the number of tags", () => {
    const reply = JSON.stringify({ tags: Array.from({ length: 20 }, (_, i) => `tag${i}`) });
    expect(parseTagReply(reply, 5)).toHaveLength(5);
  });
});

describe("similarity", () => {
  test("shared tags outweigh a shared category", () => {
    const target = asset(1, "bingo-rig.png", "bingo, rig");
    const tagMatch = asset(2, "other.png", "bingo", "Props");
    const categoryOnly = asset(3, "unrelated.png", "", "Characters");
    expect(similarityScore(target, tagMatch)).toBeGreaterThan(similarityScore(target, categoryOnly));
  });
  test("rankSimilar excludes the target, filters weak matches and sorts by score", () => {
    const target = asset(1, "bluey-character-rig.png", "bluey, rig");
    const ranked = rankSimilar(target, [
      target,
      asset(2, "bluey-expressions.png", "bluey"),
      asset(3, "bingo-character-rig.png", "bingo, rig"),
      asset(4, "kitchen-background.png", "", "Backgrounds"),
    ]);
    expect(ranked.map((r) => r.asset.id)).toEqual([3, 2]);
  });
});
