import { test, expect, mock, spyOn } from "bun:test";

// Scope the mocking strictly to this file to prevent test pollution
mock.module("better-sqlite3", () => {
  return {
    default: function Database() {
      return {
        pragma: () => {},
        exec: () => {},
        prepare: () => ({ run: () => {}, get: () => {}, all: () => {} })
      };
    }
  };
});
mock.module("drizzle-orm/better-sqlite3", () => {
  return {
    drizzle: () => ({})
  };
});

import { notifyDiscord } from "./discord.ts";
import { storage } from "./storage.ts";

test("discord notify handles fetch errors gracefully", async () => {
  // Mock storage.getProject
  spyOn(storage, "getProject").mockReturnValue({
    id: 1,
    title: "Test Project",
    dltDiscordWebhookUrl: "https://discord.com/api/webhooks/error/fail"
  } as any);

  // Mock fetch to reject with an error
  const fetchMock = mock(async () => {
    throw new Error("Network failure");
  });
  const originalFetch = global.fetch;
  global.fetch = fetchMock as any;

  // Track console.error
  const consoleErrorMock = mock(() => {});
  const originalConsoleError = console.error;
  console.error = consoleErrorMock as any;

  try {
    await notifyDiscord(1, "Test Title", "Test Description");

    // fetch should have been called
    expect(fetchMock).toHaveBeenCalled();

    // console.error should have been called
    expect(consoleErrorMock).toHaveBeenCalled();
    const errorArgs = consoleErrorMock.mock.calls[0];
    expect(errorArgs[0]).toBe("Discord webhook fetch failed:");
    expect(errorArgs[1].message).toBe("Network failure");
  } finally {
    // Restore
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
