import assert from "node:assert/strict";
import { comparePaletteSimilarity, nearestPaletteColor } from "./palette-model";

assert.deepEqual(nearestPaletteColor("#102030", ["#102030", "#FFFFFF"]), {
  color: "#102030",
  distance: 0,
});

assert.equal(comparePaletteSimilarity(["#111111", "#EEEEEE"], ["#111111", "#EEEEEE"]), 100);
assert.ok(comparePaletteSimilarity(["#111111"], ["#EEEEEE"]) < 30);
