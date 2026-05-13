import assert from "node:assert/strict";
import { notifyDiscord } from "./discord";
import { storage } from "./storage";

async function runTests() {
  const originalGetProject = storage.getProject;
  const originalFetch = global.fetch;

  let fetchCalls: any[] = [];
  global.fetch = async (...args) => {
    fetchCalls.push(args);
    return { ok: true, status: 200 } as any;
  };

  try {
    console.log("Running discord.test.ts...");

    // `storage.getProject` is synchronous! It returns a Project, not a Promise<Project>.

    // Test 1: Project not found
    storage.getProject = () => undefined as any;
    await notifyDiscord(1, "Title", "Desc");
    assert.equal(fetchCalls.length, 0, "Should not fetch if project is not found");

    // Test 2: Project has no webhookUrl
    storage.getProject = () => ({ id: 1, title: "Test Project" } as any);
    await notifyDiscord(1, "Title", "Desc");
    assert.equal(fetchCalls.length, 0, "Should not fetch if webhookUrl is missing");

    // Test 3: Project has invalid webhookUrl string
    storage.getProject = () => ({ id: 1, title: "Test Project", dltDiscordWebhookUrl: "not-a-url" } as any);
    await notifyDiscord(1, "Title", "Desc");
    assert.equal(fetchCalls.length, 0, "Should not fetch if webhookUrl is invalid");

    // Test 4: Project has unsupported protocol
    storage.getProject = () => ({ id: 1, title: "Test Project", dltDiscordWebhookUrl: "ftp://example.com/webhook" } as any);
    await notifyDiscord(1, "Title", "Desc");
    assert.equal(fetchCalls.length, 0, "Should not fetch if protocol is not http or https");

    // Test 5: Happy path
    storage.getProject = () => ({
      id: 1,
      title: "Test Project",
      dltDiscordWebhookUrl: "https://discord.com/api/webhooks/123/abc"
    } as any);
    await notifyDiscord(1, "My Title", "My Description");
    assert.equal(fetchCalls.length, 1, "Should make 1 fetch call");
    assert.equal(fetchCalls[0][0], "https://discord.com/api/webhooks/123/abc");
    const fetchOptions = fetchCalls[0][1];
    assert.equal(fetchOptions.method, "POST");
    assert.equal(fetchOptions.headers["Content-Type"], "application/json");

    const body = JSON.parse(fetchOptions.body);
    assert.equal(body.embeds.length, 1);
    assert.equal(body.embeds[0].title, "My Title");
    assert.equal(body.embeds[0].description, "My Description");
    assert.equal(body.embeds[0].color, 0x9DD0FF); // default color
    assert.equal(body.embeds[0].footer.text, "Cel · Test Project");

    fetchCalls = []; // reset

    // Test 6: Happy path with valid brand color parsing
    storage.getProject = () => ({
      id: 1,
      title: "Test Project",
      dltDiscordWebhookUrl: "https://discord.com/api/webhooks/123/abc",
      cli_brandColor: "#FF5500"
    } as any);
    await notifyDiscord(1, "Color Title", "Color Desc");
    assert.equal(fetchCalls.length, 1);
    const bodyColor = JSON.parse(fetchCalls[0][1].body);
    assert.equal(bodyColor.embeds[0].color, 0xFF5500);

    fetchCalls = []; // reset

    // Test 7: Description truncation
    const longDesc = "a".repeat(4500);
    await notifyDiscord(1, "Truncate Title", longDesc);
    assert.equal(fetchCalls.length, 1);
    const bodyTruncated = JSON.parse(fetchCalls[0][1].body);
    assert.equal(bodyTruncated.embeds[0].description.length, 4001); // 4000 chars + "…"
    assert.equal(bodyTruncated.embeds[0].description.endsWith("…"), true);

    console.log("server/discord tests passed");
  } finally {
    // Restore mocks
    storage.getProject = originalGetProject;
    global.fetch = originalFetch;
  }
}

runTests().catch((err) => {
  console.error("Tests failed:", err);
  process.exit(1);
});
