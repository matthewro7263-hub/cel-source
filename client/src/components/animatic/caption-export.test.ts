import assert from "node:assert/strict";
import {
  buildSrt,
  buildVtt,
  parseCaptionTimeMs,
  type CaptionExportCue,
} from "./caption-export";

const cues: CaptionExportCue[] = [
  { startMs: 2_500, endMs: 4_100, text: "Second beat" },
  { startMs: 0, endMs: 1_250, text: "First beat\ncontinues" },
];

assert.equal(parseCaptionTimeMs("00:01:02.345"), 62_345);
assert.equal(parseCaptionTimeMs("01:00:00,005"), 3_600_005);
assert.equal(parseCaptionTimeMs("bad"), null);

assert.equal(
  buildVtt(cues),
  [
    "WEBVTT",
    "",
    "00:00:00.000 --> 00:00:01.250",
    "First beat",
    "continues",
    "",
    "00:00:02.500 --> 00:00:04.100",
    "Second beat",
    "",
  ].join("\n"),
);

assert.equal(
  buildSrt(cues),
  [
    "1",
    "00:00:00,000 --> 00:00:01,250",
    "First beat",
    "continues",
    "",
    "2",
    "00:00:02,500 --> 00:00:04,100",
    "Second beat",
    "",
  ].join("\n"),
);
