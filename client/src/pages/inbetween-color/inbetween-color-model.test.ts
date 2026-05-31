import assert from "node:assert/strict";
import { buildInbetweenFrames, floodFillPixels, hexToRgb } from "./inbetween-color-model";

assert.deepEqual(buildInbetweenFrames(3), [
  { index: 1, alpha: 0.25, label: "Inbetween 1" },
  { index: 2, alpha: 0.5, label: "Inbetween 2" },
  { index: 3, alpha: 0.75, label: "Inbetween 3" },
]);

assert.deepEqual(hexToRgb("#9DD0FF"), { r: 157, g: 208, b: 255, a: 255 });
assert.deepEqual(hexToRgb("#abc"), { r: 170, g: 187, b: 204, a: 255 });

const data = new Uint8ClampedArray([
  255, 255, 255, 255, 255, 255, 255, 255,
  255, 255, 255, 255, 0, 0, 0, 255,
]);

const result = floodFillPixels({
  data,
  width: 2,
  height: 2,
  x: 0,
  y: 0,
  fill: { r: 10, g: 20, b: 30, a: 255 },
  tolerance: 4,
});

assert.equal(result.changed, 3);
assert.deepEqual(result.bounds, { minX: 0, minY: 0, maxX: 1, maxY: 1 });
assert.deepEqual(Array.from(result.data.slice(0, 4)), [10, 20, 30, 255]);
assert.deepEqual(Array.from(result.data.slice(12, 16)), [0, 0, 0, 255]);
