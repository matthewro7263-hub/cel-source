import assert from "node:assert/strict";
import {
  duplicateClip,
  findClipAtTime,
  formatTimestamp,
  getClipSpans,
  moveClipById,
  sanitizeDurationMs,
  splitClipAtPlayhead,
  type VideoEditorClip,
} from "./model";

const clips: VideoEditorClip[] = [
  {
    id: "a",
    kind: "panel",
    src: "panel-a",
    label: "Panel A",
    durationMs: 1000,
  },
  {
    id: "b",
    kind: "animatic",
    src: "video-b",
    label: "Video B",
    durationMs: 2500,
    sourceDurationMs: 5000,
    trimStartMs: 1000,
  },
  {
    id: "c",
    kind: "panel",
    src: "panel-c",
    label: "Panel C",
    durationMs: 500,
  },
];

assert.equal(formatTimestamp(61_234), "1:01.23");
assert.equal(formatTimestamp(-12), "0:00.00");

assert.equal(sanitizeDurationMs(24), 100);
assert.equal(sanitizeDurationMs(123_456), 120_000);

assert.deepEqual(
  getClipSpans(clips).map(({ clip, startMs, endMs }) => [clip.id, startMs, endMs]),
  [
    ["a", 0, 1000],
    ["b", 1000, 3500],
    ["c", 3500, 4000],
  ],
);

assert.deepEqual(findClipAtTime(clips, 1200), {
  clip: clips[1],
  index: 1,
  startMs: 1000,
  endMs: 3500,
  localMs: 200,
});

assert.equal(findClipAtTime(clips, 999)?.clip.id, "a");
assert.equal(findClipAtTime(clips, 4000)?.clip.id, "c");

assert.deepEqual(moveClipById(clips, "c", -1).map((clip) => clip.id), ["a", "c", "b"]);
assert.deepEqual(moveClipById(clips, "a", -1).map((clip) => clip.id), ["a", "b", "c"]);

const duplicated = duplicateClip(clips, "b", () => "b-copy");
assert.deepEqual(duplicated.map((clip) => clip.id), ["a", "b", "b-copy", "c"]);
assert.equal(duplicated[2].label, "Video B copy");
assert.equal(duplicated[2].trimStartMs, 1000);

const split = splitClipAtPlayhead(clips, "b", 2200, (suffix) => `b-${suffix}`);
assert.deepEqual(split.clips.map((clip) => `${clip.id}:${clip.durationMs}:${clip.trimStartMs ?? 0}`), [
  "a:1000:0",
  "b-left:1200:1000",
  "b-right:1300:2200",
  "c:500:0",
]);
assert.equal(split.selectedClipId, "b-right");

assert.equal(splitClipAtPlayhead(clips, "b", 1000, () => "unused").clips, clips);
assert.equal(splitClipAtPlayhead(clips, "b", 3500, () => "unused").clips, clips);

console.log("video-editor model tests passed");
