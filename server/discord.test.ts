import { test, expect, mock, spyOn } from "bun:test";

// Mock better-sqlite3 and drizzle-orm EXACTLY as requested by user
mock.module('better-sqlite3', () => ({
  default: class {
    constructor() {}
    prepare() { return { run: () => {}, get: () => undefined, all: () => [] }; }
    exec() {}
    pragma() {}
    close() {}
  }
}));

mock.module('drizzle-orm/better-sqlite3', () => ({
  drizzle: () => ({})
}));

// Also mock bindings to prevent the underlying error if transitive imports evaluate too early
mock.module('bindings', () => () => ({}));

// Workaround for `storage.ts` evaluating before the mock is successfully hoisted in bun
mock.module("./storage.ts", () => ({ storage: { getProject: () => undefined } }));
mock.module("./storage", () => ({ storage: { getProject: () => undefined } }));

test("notifyDiscord gracefully handles malformed webhook URLs", async () => {
  // Use dynamic import so it doesn't trigger static evaluation of module graph containing better-sqlite3 before mock.module runs
  const { notifyDiscord } = await import("./discord.ts");
  const { storage } = await import("./storage.ts");

  spyOn(storage, "getProject").mockImplementation((id: number) => ({
    id,
    title: "Test Project",
    dltDiscordWebhookUrl: "http://[invalid" // Throws on URL parsing
  } as any));

  const fetchMock = mock(async () => new Response());
  const originalFetch = global.fetch;
  global.fetch = fetchMock;

  const originalConsoleError = console.error;
  const consoleErrorMock = mock((...args) => {});
  console.error = consoleErrorMock;

  try {
    await notifyDiscord(1, "Test Title", "Test Description");

    // Assert that fetch was NOT called
    expect(fetchMock).not.toHaveBeenCalled();
    // And error was logged
    expect(consoleErrorMock).toHaveBeenCalled();
  } finally {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
