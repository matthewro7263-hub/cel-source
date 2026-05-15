import assert from "node:assert/strict";
import {
  buildLightingPlan,
  buildSunPathSamples,
  rankHdriLocations,
} from "./light-lab-model";

const summerPath = buildSunPathSamples("summer");
assert.equal(summerPath.length, 7);
assert.equal(summerPath[0]?.hour, 6);
assert.equal(summerPath.at(-1)?.hour, 18);
assert.ok((summerPath[3]?.y ?? 0) < (summerPath[0]?.y ?? 0), "midday should sit higher than sunrise");

const goldenPlan = buildLightingPlan({
  hour: 18,
  season: "autumn",
  cloudCover: 12,
  mood: "golden",
});

assert.match(goldenPlan.summary, /golden hour/i);
assert.ok(goldenPlan.kelvin >= 4200 && goldenPlan.kelvin <= 5600, "golden hour should stay warm");
assert.ok(goldenPlan.shadowSoftness < 40, "golden hour should keep shadows reasonably crisp");

const stormRanked = rankHdriLocations({
  hour: 21,
  season: "winter",
  cloudCover: 88,
  mood: "storm",
});

assert.equal(stormRanked[0]?.id, "storm-coast");
assert.ok((stormRanked[0]?.score ?? 0) > (stormRanked[1]?.score ?? 0));
