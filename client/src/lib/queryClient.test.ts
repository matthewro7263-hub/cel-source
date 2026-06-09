import assert from "node:assert/strict";
import { buildQueryUrl } from "./queryClient.ts";

assert.equal(buildQueryUrl(["/api/projects"]), "/api/projects");
assert.equal(buildQueryUrl(["/api/projects", 5, "storyboards"]), "/api/projects/5/storyboards");
assert.equal(buildQueryUrl(["/api/projects", 5]), "/api/projects/5");
assert.equal(buildQueryUrl(["/api/scenes", 12, "renders"]), "/api/scenes/12/renders");
assert.equal(buildQueryUrl(["/api/projects", 3, "ai", "key"]), "/api/projects/3/ai/key");

console.log("queryClient buildQueryUrl tests passed");