import assert from "node:assert/strict";
import { initials, formatDeadline } from "./utils-cel.ts";

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

const today = new Date();
today.setHours(0, 0, 0, 0);

function addDays(days: number): string {
  const d = new Date(today);
  d.setDate(today.getDate() + days);
  return d.toISOString();
}

// Edge cases
assert.deepEqual(formatDeadline(), { text: "No deadline", tone: "muted" });
assert.deepEqual(formatDeadline(null), { text: "No deadline", tone: "muted" });
assert.deepEqual(formatDeadline(""), { text: "No deadline", tone: "muted" });

// Overdue
assert.deepEqual(formatDeadline(addDays(-1)), { text: "1d overdue", tone: "red" });
assert.deepEqual(formatDeadline(addDays(-5)), { text: "5d overdue", tone: "red" });

// Due today
assert.deepEqual(formatDeadline(addDays(0)), { text: "Due today", tone: "red" });

// Amber (soon)
assert.deepEqual(formatDeadline(addDays(1)), { text: "in 1d", tone: "amber" });
assert.deepEqual(formatDeadline(addDays(3)), { text: "in 3d", tone: "amber" });

// Green (later)
assert.deepEqual(formatDeadline(addDays(4)), { text: "in 4d", tone: "green" });
assert.deepEqual(formatDeadline(addDays(14)), { text: "in 14d", tone: "green" });

// Muted (much later)
assert.deepEqual(formatDeadline(addDays(15)), { text: "in 15d", tone: "muted" });
assert.deepEqual(formatDeadline(addDays(30)), { text: "in 30d", tone: "muted" });

console.log("utils-cel formatDeadline tests passed");
