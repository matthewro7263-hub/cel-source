import { mock } from "bun:test";
import assert from "node:assert/strict";

// Mock the presigner before importing r2.ts
mock.module("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: async () => "https://mocked-signed-url.com",
}));

// We can statically import isOwnedKey since it has no side effects,
// but for presignUpload tests we should ensure the module was loaded
// after the mock. However, dynamic import is cleaner.
async function runTests() {
  const { isOwnedKey, presignUpload } = await import("./r2.ts");

  // Existing isOwnedKey tests
  assert.equal(isOwnedKey("user123", "uploads/user123/profile.png"), true);
  assert.equal(isOwnedKey("user123", "uploads/user123/avatars/profile.png"), true);
  assert.equal(isOwnedKey("user123", "uploads/otherUser/profile.png"), false);
  assert.equal(isOwnedKey("user1", "uploads/user12/profile.png"), false);
  assert.equal(isOwnedKey("user123", "downloads/user123/profile.png"), false);
  assert.equal(isOwnedKey("user123", "user123/profile.png"), false);
  assert.equal(isOwnedKey("", "uploads//profile.png"), true);
  assert.equal(isOwnedKey("", "uploads/user123/profile.png"), false);
  assert.equal(isOwnedKey("user123", ""), false);

  console.log("isOwnedKey tests passed");

  // Case 1: Minimal options
  const res1 = await presignUpload({
    userId: "user1",
    filename: "test.jpg",
    contentType: "image/jpeg",
  });

  assert.equal(res1.expiresIn, 300);
  assert.equal(res1.url, "https://mocked-signed-url.com");
  assert.equal(res1.method, "PUT");
  assert.deepEqual(res1.headers, { "Content-Type": "image/jpeg" });
  assert.match(res1.key, /^uploads\/user1\/[a-f0-9\-]{36}-test\.jpg$/);

  // Case 2: Custom prefix and expiresIn
  const res2 = await presignUpload({
    userId: "user2",
    filename: "video.mp4",
    contentType: "video/mp4",
    prefix: "animatics",
    expiresIn: 600,
  });

  assert.equal(res2.expiresIn, 600);
  assert.equal(res2.url, "https://mocked-signed-url.com");
  assert.match(res2.key, /^uploads\/user2\/animatics\/[a-f0-9\-]{36}-video\.mp4$/);

  // Case 3: Filename sanitization
  const res3 = await presignUpload({
    userId: "user3",
    filename: "My Awesome Video (Final)!.mp4",
    contentType: "video/mp4",
  });

  assert.match(res3.key, /^uploads\/user3\/[a-f0-9\-]{36}-My_Awesome_Video_Final_\.mp4$/);

  console.log("presignUpload tests passed");
}

runTests().catch((err) => {
  console.error("Test failed", err);
  process.exit(1);
});
