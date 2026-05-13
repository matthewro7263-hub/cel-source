import assert from "node:assert/strict";
import { initials } from "./utils-cel.ts";

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

import { youTubeId } from "./utils-cel.ts";

// YouTube ID tests
// Full URL
assert.equal(youTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");

// Short URL
assert.equal(youTubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");

// Embed URL
assert.equal(youTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");

// Additional query parameters
assert.equal(youTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s"), "dQw4w9WgXcQ");

// Shorts URL
assert.equal(youTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");

// Invalid URL
assert.equal(youTubeId("https://www.youtube.com/watch?v="), null);

// Non-YouTube URL
assert.equal(youTubeId("https://vimeo.com/123456789"), null);

// Empty string
assert.equal(youTubeId(""), null);

console.log("utils-cel youTubeId tests passed");
