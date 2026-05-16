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

// Also mock neon so it doesn't fail either, as standard on main
mock.module('@neondatabase/serverless', () => ({
  Pool: class {
    constructor() {}
    query() {}
    connect() {}
    end() {}
  }
}));
mock.module('drizzle-orm/neon-serverless', () => ({
  drizzle: () => ({})
}));

import { notifyDiscord } from "./discord.ts";
import { storage } from "./storage.ts";

test("notifyDiscord gracefully handles malformed webhook URLs", async () => {
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
