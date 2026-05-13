import assert from "node:assert/strict";
import { initials, formatDeadline, vimeoId } from "./utils-cel.ts";
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

console.log("utils-cel initials tests passed");

// --- formatDeadline tests ---

// Helper to get a date string offset by N days from today
function getOffsetDateString(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  // Format as YYYY-MM-DD
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Falsy inputs
assert.deepEqual(formatDeadline(), { text: "No deadline", tone: "muted" });
assert.deepEqual(formatDeadline(null), { text: "No deadline", tone: "muted" });
assert.deepEqual(formatDeadline(""), { text: "No deadline", tone: "muted" });

// Overdue (< 0 days)
assert.deepEqual(formatDeadline(getOffsetDateString(-5)), { text: "5d overdue", tone: "red" });
assert.deepEqual(formatDeadline(getOffsetDateString(-1)), { text: "1d overdue", tone: "red" });

// Due today (0 days)
assert.deepEqual(formatDeadline(getOffsetDateString(0)), { text: "Due today", tone: "red" });

// Due soon (<= 3 days)
assert.deepEqual(formatDeadline(getOffsetDateString(1)), { text: "in 1d", tone: "amber" });
assert.deepEqual(formatDeadline(getOffsetDateString(3)), { text: "in 3d", tone: "amber" });

// Due reasonably soon (<= 14 days)
assert.deepEqual(formatDeadline(getOffsetDateString(4)), { text: "in 4d", tone: "green" });
assert.deepEqual(formatDeadline(getOffsetDateString(14)), { text: "in 14d", tone: "green" });

// Due later (> 14 days)
assert.deepEqual(formatDeadline(getOffsetDateString(15)), { text: "in 15d", tone: "muted" });
assert.deepEqual(formatDeadline(getOffsetDateString(30)), { text: "in 30d", tone: "muted" });

console.log("utils-cel formatDeadline tests passed");
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
