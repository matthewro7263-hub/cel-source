import assert from "node:assert/strict";
import { initials, vimeoId } from "./utils-cel.ts";

// --- initials tests ---

// Standard two names
assert.equal(initials("John Doe"), "JD");

// Lowercase input should result in uppercase initials
assert.equal(initials("john doe"), "JD");

// Single name
assert.equal(initials("John"), "J");

// More than two names (should only take first two)
assert.equal(initials("John Doe Smith"), "JD");

// Extra spaces between and around names
assert.equal(initials("  John   Doe  "), "JD");

// Empty string
assert.equal(initials(""), "");

// Numbers and special characters
assert.equal(initials("123 456"), "14");

// --- vimeoId tests ---

// Standard URL
assert.equal(vimeoId("https://vimeo.com/123456789"), "123456789");

// URL without https
assert.equal(vimeoId("vimeo.com/123456789"), "123456789");

// URL with www
assert.equal(vimeoId("https://www.vimeo.com/123456789"), "123456789");

// URL with parameters
assert.equal(vimeoId("https://vimeo.com/123456789?param=value"), "123456789");

// Invalid URL (no ID)
assert.equal(vimeoId("https://vimeo.com/"), null);

// Invalid URL (not vimeo)
assert.equal(vimeoId("https://youtube.com/123456789"), null);

// Invalid URL (letters instead of numbers)
assert.equal(vimeoId("https://vimeo.com/abcdef"), null);

console.log("utils-cel tests passed");
