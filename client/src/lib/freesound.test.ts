import { test, expect } from "bun:test";
import { getPreviewUrl, type FreesoundResult } from "./freesound.ts";

function createMockResult(previews: Partial<FreesoundResult["previews"]> = {}): FreesoundResult {
  return {
    id: 123,
    name: "test sound",
    duration: 10,
    username: "testuser",
    license: "CC0",
    previews,
  };
}

test("Returns lq-mp3 if available (highest precedence)", () => {
  expect(
    getPreviewUrl(createMockResult({
      "preview-lq-mp3": "lq.mp3",
      "preview-hq-mp3": "hq.mp3",
      "preview-lq-ogg": "lq.ogg",
      "preview-hq-ogg": "hq.ogg",
    }))
  ).toBe("lq.mp3");
});

test("Returns hq-mp3 if lq-mp3 is not available", () => {
  expect(
    getPreviewUrl(createMockResult({
      "preview-hq-mp3": "hq.mp3",
      "preview-lq-ogg": "lq.ogg",
      "preview-hq-ogg": "hq.ogg",
    }))
  ).toBe("hq.mp3");
});

test("Returns lq-ogg if mp3s are not available", () => {
  expect(
    getPreviewUrl(createMockResult({
      "preview-lq-ogg": "lq.ogg",
      "preview-hq-ogg": "hq.ogg",
    }))
  ).toBe("lq.ogg");
});

test("Returns hq-ogg if nothing else is available", () => {
  expect(
    getPreviewUrl(createMockResult({
      "preview-hq-ogg": "hq.ogg",
    }))
  ).toBe("hq.ogg");
});

test("Returns empty string if no previews are available", () => {
  expect(
    getPreviewUrl(createMockResult({}))
  ).toBe("");
});
