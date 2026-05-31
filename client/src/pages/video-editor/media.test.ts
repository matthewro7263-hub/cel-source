import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { isCanvasDrawableVideoSource } from "./media";

describe("isCanvasDrawableVideoSource", () => {
  let originalWindow: any;

  beforeAll(() => {
    originalWindow = globalThis.window;
    // Mock window object for tests
    globalThis.window = {
      location: {
        href: "https://example.com/editor",
        origin: "https://example.com",
      },
    } as any;
  });

  afterAll(() => {
    globalThis.window = originalWindow;
  });

  test("returns false for falsy or empty source", () => {
    expect(isCanvasDrawableVideoSource("")).toBe(false);
    expect(isCanvasDrawableVideoSource(null as unknown as string)).toBe(false);
    expect(isCanvasDrawableVideoSource(undefined as unknown as string)).toBe(false);
  });

  test("returns true for data URLs", () => {
    expect(isCanvasDrawableVideoSource("data:video/mp4;base64,AAAA")).toBe(true);
    expect(isCanvasDrawableVideoSource("data:video/webm;base64,BBBB")).toBe(true);
  });

  test("returns true for blob URLs", () => {
    expect(isCanvasDrawableVideoSource("blob:https://example.com/1234-5678")).toBe(true);
  });

  test("returns true for same-origin relative URLs", () => {
    expect(isCanvasDrawableVideoSource("/assets/video.mp4")).toBe(true);
    expect(isCanvasDrawableVideoSource("video.webm")).toBe(true);
    expect(isCanvasDrawableVideoSource("./media/clip.mp4")).toBe(true);
  });

  test("returns true for same-origin absolute URLs", () => {
    expect(isCanvasDrawableVideoSource("https://example.com/video.mp4")).toBe(true);
    expect(isCanvasDrawableVideoSource("https://example.com/assets/clip.webm")).toBe(true);
  });

  test("returns false for cross-origin URLs", () => {
    expect(isCanvasDrawableVideoSource("https://other-domain.com/video.mp4")).toBe(false);
    expect(isCanvasDrawableVideoSource("http://example.com/video.mp4")).toBe(false); // different protocol
  });

  test("returns false when URL parsing throws", () => {
    // If the base URL is somehow invalid and source is not a valid absolute URL.
    // In our case window.location.href is valid, but we can temporarily mock it to be invalid
    // to test the catch block.
    const originalHref = window.location.href;
    try {
      window.location.href = "invalid-base-url";
      expect(isCanvasDrawableVideoSource("relative-video.mp4")).toBe(false);
    } finally {
      window.location.href = originalHref;
    }
  });
});
