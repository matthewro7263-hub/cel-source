import assert from "node:assert/strict";
import {
  buildMohoSwitchDat,
  generateLipsyncTimeline,
  mergeAdjacentVisemes,
} from "./lipsync-model";

const timeline = generateLipsyncTimeline("Mom, wave!", { msPerPhoneme: 80, wordGapMs: 60 });

assert.deepEqual(
  timeline.slice(0, 5).map((item) => item.viseme),
  ["MBP", "O", "MBP", "rest", "WQ"],
);
assert.equal(timeline[0].startMs, 0);
assert.equal(timeline[0].endMs, 80);
assert.equal(timeline[3].startMs, 240);
assert.equal(timeline[3].endMs, 300);

const merged = mergeAdjacentVisemes([
  { viseme: "rest", startMs: 0, endMs: 40 },
  { viseme: "rest", startMs: 40, endMs: 80 },
  { viseme: "AI", startMs: 80, endMs: 120 },
]);

assert.deepEqual(merged, [
  { viseme: "rest", startMs: 0, endMs: 80 },
  { viseme: "AI", startMs: 80, endMs: 120 },
]);

assert.equal(
  buildMohoSwitchDat([
    { viseme: "MBP", startMs: 0, endMs: 80 },
    { viseme: "O", startMs: 80, endMs: 160 },
    { viseme: "rest", startMs: 160, endMs: 240 },
  ], 24),
  "0 MBP\n2 O\n4 rest\n",
);
