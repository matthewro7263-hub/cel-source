import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const app = readFileSync("client/src/App.tsx", "utf8");
const shell = readFileSync("client/src/components/AppShell.tsx", "utf8");
const workspace = readFileSync("client/src/pages/ProjectWorkspace.tsx", "utf8");
const videoEditor = readFileSync("client/src/pages/video-editor/index.tsx", "utf8");
const compare = readFileSync("client/src/pages/compare/index.tsx", "utf8");
const reviewRoom = readFileSync("client/src/pages/review-room/index.tsx", "utf8");
const lightLab = readFileSync("client/src/pages/studio/LightLab.tsx", "utf8");
const business = readFileSync("client/src/pages/biz/index.tsx", "utf8");
const analytics = readFileSync("client/src/pages/analytics/index.tsx", "utf8");
const commissions = readFileSync("client/src/pages/CommissionsQueue.tsx", "utf8");

const requiredProjectRoutes = [
  "/projects/:id/script",
  "/projects/:id/storyboards",
  "/projects/:id/assets",
  "/projects/:id/animatics",
  "/projects/:id/scenes",
  "/projects/:id/comments",
  "/projects/:id/continuity",
  "/projects/:id/casting",
  "/projects/:id/signoff",
  "/projects/:id/settings",
];

for (const route of requiredProjectRoutes) {
  assert.match(app, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `App router should expose ${route}`);
}

assert.ok(
  existsSync("client/src/components/layout/tool-workspace.tsx"),
  "tool workspace layout primitive should exist",
);
assert.ok(
  existsSync("client/src/components/layout/data-workspace.tsx"),
  "data workspace layout primitive should exist",
);

assert.match(
  shell,
  /md:/,
  "app shell should define a tablet-aware breakpoint state instead of only mobile and desktop extremes",
);

assert.doesNotMatch(
  workspace,
  /<TabsTrigger value="script"/,
  "project root should stop using the all-in-one tabbed workspace as the primary model",
);
assert.match(
  workspace,
  /Overview|Production|Review|Settings/,
  "project workspace should expose grouped second-level navigation labels",
);

assert.match(videoEditor, /ToolWorkspace/, "video editor should use the shared tool workspace");
assert.match(compare, /ToolWorkspace/, "compare should use the shared tool workspace");
assert.match(reviewRoom, /ToolWorkspace/, "review room should use the shared tool workspace");
assert.match(lightLab, /ToolWorkspace/, "light lab should use the shared tool workspace");

assert.match(business, /DataWorkspace/, "business should use the shared data workspace");
assert.match(analytics, /DataWorkspace/, "analytics should use the shared data workspace");
assert.match(commissions, /DataWorkspace/, "commissions should use the shared data workspace");
