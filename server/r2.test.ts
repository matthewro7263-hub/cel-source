import assert from "node:assert/strict";
import { isOwnedKey } from "./r2.ts";

// Happy path
assert.equal(isOwnedKey("user123", "uploads/user123/profile.png"), true);

// Happy path with subfolder
assert.equal(isOwnedKey("user123", "uploads/user123/avatars/profile.png"), true);

// Negative path (different user)
assert.equal(isOwnedKey("user123", "uploads/otherUser/profile.png"), false);

// Edge case (similar prefix - checking trailing slash)
// "uploads/user12/" does not start with "uploads/user1/"
assert.equal(isOwnedKey("user1", "uploads/user12/profile.png"), false);

// Edge case (missing uploads prefix)
assert.equal(isOwnedKey("user123", "downloads/user123/profile.png"), false);
assert.equal(isOwnedKey("user123", "user123/profile.png"), false);

// Edge case (empty userId)
// An empty userId would check for "uploads//"
assert.equal(isOwnedKey("", "uploads//profile.png"), true);
assert.equal(isOwnedKey("", "uploads/user123/profile.png"), false);

// Edge case (empty key)
assert.equal(isOwnedKey("user123", ""), false);

console.log("server/r2 tests passed");
