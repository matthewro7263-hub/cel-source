import { describe, test, beforeAll, afterAll } from "bun:test";
import assert from "node:assert/strict";
import { isCanvasDrawableVideoSource } from "./media";

describe("isCanvasDrawableVideoSource", () => {
  beforeAll(() => {
    // Mock window object for tests
    // @ts-ignore
    global.window = {
      location: {
        href: "https://example.com/editor",
        origin: "https://example.com",
      },
    };
  });

  afterAll(() => {
    // @ts-ignore
    delete global.window;
  });

  test("returns false for empty string", () => {
    assert.equal(isCanvasDrawableVideoSource(""), false);
  });

  test("returns true for data:video/ URI", () => {
    assert.equal(isCanvasDrawableVideoSource("data:video/mp4;base64,AAAA"), true);
    assert.equal(isCanvasDrawableVideoSource("data:video/webm;base64,BBBB"), true);
  });

  test("returns true for blob: URI", () => {
    assert.equal(isCanvasDrawableVideoSource("blob:https://example.com/1234-5678"), true);
  });

  test("returns true for same-origin absolute URL", () => {
    assert.equal(isCanvasDrawableVideoSource("https://example.com/video.mp4"), true);
  });

  test("returns true for relative URL (which resolves to same-origin)", () => {
    assert.equal(isCanvasDrawableVideoSource("/local-video.mp4"), true);
    assert.equal(isCanvasDrawableVideoSource("assets/video.webm"), true);
  });

  test("returns false for cross-origin URLs", () => {
    assert.equal(isCanvasDrawableVideoSource("https://other-domain.com/video.mp4"), false);
    assert.equal(isCanvasDrawableVideoSource("http://example.com/video.mp4"), false); // HTTP vs HTTPS is cross-origin
  });

  test("returns false for invalid URLs that don't match data/blob", () => {
    assert.equal(isCanvasDrawableVideoSource("not-a-valid-url: something"), false);
  });
});
