import assert from "node:assert/strict";
import { notifyDiscord } from "./discord";
import { storage } from "./storage";

async function runTests() {
  const originalGetProject = storage.getProject;
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;

  let fetchCalls: Array<[Parameters<typeof fetch>[0], Parameters<typeof fetch>[1]]> = [];
  const errors: unknown[][] = [];

  global.fetch = (async (...args: Parameters<typeof fetch>) => {
    fetchCalls.push(args);
    return { ok: true, status: 200 } as Response;
  }) as typeof fetch;

  console.error = (...args: unknown[]) => {
    errors.push(args);
  };

  try {
    storage.getProject = () => undefined as any;
    await notifyDiscord(1, "Title", "Desc");
    assert.equal(fetchCalls.length, 0, "should not fetch when project is missing");

    storage.getProject = () => ({ id: 1, title: "Test Project" } as any);
    await notifyDiscord(1, "Title", "Desc");
    assert.equal(fetchCalls.length, 0, "should not fetch when webhook URL is missing");

    storage.getProject = () => ({
      id: 1,
      title: "Test Project",
      dltDiscordWebhookUrl: "not-a-url",
    } as any);
    await notifyDiscord(1, "Title", "Desc");
    assert.equal(fetchCalls.length, 0, "should not fetch when webhook URL is invalid");

    storage.getProject = () => ({
      id: 1,
      title: "Test Project",
      dltDiscordWebhookUrl: "http://[invalid",
    } as any);
    await notifyDiscord(1, "Title", "Desc");
    assert.equal(fetchCalls.length, 0, "should not fetch when URL parsing throws");

    storage.getProject = () => ({
      id: 1,
      title: "Test Project",
      dltDiscordWebhookUrl: "ftp://example.com/webhook",
    } as any);
    await notifyDiscord(1, "Title", "Desc");
    assert.equal(fetchCalls.length, 0, "should not fetch when protocol is unsupported");

    storage.getProject = () => ({
      id: 1,
      title: "Test Project",
      dltDiscordWebhookUrl: "https://discord.com/api/webhooks/123/abc",
    } as any);
    await notifyDiscord(1, "My Title", "My Description");
    assert.equal(fetchCalls.length, 1, "should send one webhook request");
    assert.equal(fetchCalls[0][0], "https://discord.com/api/webhooks/123/abc");

    const fetchOptions = fetchCalls[0][1]!;
    assert.equal(fetchOptions.method, "POST");
    assert.deepEqual(fetchOptions.headers, { "Content-Type": "application/json" });

    const body = JSON.parse(String(fetchOptions.body));
    assert.equal(body.embeds.length, 1);
    assert.equal(body.embeds[0].title, "My Title");
    assert.equal(body.embeds[0].description, "My Description");
    assert.equal(body.embeds[0].color, 0x9DD0FF);
    assert.equal(body.embeds[0].footer.text, "Cel \u00b7 Test Project");

    fetchCalls = [];
    storage.getProject = () => ({
      id: 1,
      title: "Test Project",
      dltDiscordWebhookUrl: "https://discord.com/api/webhooks/123/abc",
      cli_brandColor: "#FF5500",
    } as any);
    await notifyDiscord(1, "Color Title", "Color Desc");
    assert.equal(fetchCalls.length, 1);
    assert.equal(JSON.parse(String(fetchCalls[0][1]!.body)).embeds[0].color, 0xFF5500);

    fetchCalls = [];
    const longDesc = "a".repeat(4500);
    await notifyDiscord(1, "Truncate Title", longDesc);
    const truncated = JSON.parse(String(fetchCalls[0][1]!.body)).embeds[0].description;
    assert.equal(truncated.length, 4001);
    assert.equal(truncated.endsWith("\u2026"), true);

    fetchCalls = [];
    global.fetch = (async () => {
      throw new Error("Network failure");
    }) as typeof fetch;
    await notifyDiscord(1, "Fetch Error", "Fetch error path");
    assert.equal(fetchCalls.length, 0);
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], "Discord webhook fetch failed:");
    assert.equal((errors[0][1] as Error).message, "Network failure");
  } finally {
    storage.getProject = originalGetProject;
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  }
}

runTests().catch((err) => {
  console.error("server/discord.test.ts failed:", err);
  process.exit(1);
});
