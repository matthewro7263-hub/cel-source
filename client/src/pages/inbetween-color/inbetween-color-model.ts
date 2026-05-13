export type Rgb = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

export type InbetweenFrame = {
  index: number;
  alpha: number;
  label: string;
};

export function clampInbetweenCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(24, Math.round(value)));
}

export function buildInbetweenFrames(count: number): InbetweenFrame[] {
  const safeCount = clampInbetweenCount(count);
  return Array.from({ length: safeCount }, (_, idx) => {
    const index = idx + 1;
    return {
      index,
      alpha: index / (safeCount + 1),
      label: `Inbetween ${index}`,
    };
  });
}

export function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace("#", "").trim();
  const value = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return { r: 157, g: 208, b: 255, a: 255 };
  }

  const int = Number.parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
    a: 255,
  };
}

export function rgbaDistance(a: Rgb, b: Rgb): number {
  const da = (a.a ?? 255) - (b.a ?? 255);
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt((dr * dr) + (dg * dg) + (db * db) + (da * da));
}

export type FloodFillInput = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  x: number;
  y: number;
  fill: Rgb;
  tolerance: number;
};

export type FloodFillResult = {
  data: Uint8ClampedArray;
  changed: number;
  bounds: null | {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
};

function pixelAt(data: Uint8ClampedArray, width: number, x: number, y: number): Rgb {
  const idx = ((y * width) + x) * 4;
  return {
    r: data[idx] ?? 0,
    g: data[idx + 1] ?? 0,
    b: data[idx + 2] ?? 0,
    a: data[idx + 3] ?? 255,
  };
}

function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, fill: Rgb) {
  const idx = ((y * width) + x) * 4;
  data[idx] = fill.r;
  data[idx + 1] = fill.g;
  data[idx + 2] = fill.b;
  data[idx + 3] = fill.a ?? 255;
}

export function floodFillPixels(input: FloodFillInput): FloodFillResult {
  const width = Math.max(0, Math.floor(input.width));
  const height = Math.max(0, Math.floor(input.height));
  const startX = Math.floor(input.x);
  const startY = Math.floor(input.y);

  if (
    width <= 0
    || height <= 0
    || startX < 0
    || startY < 0
    || startX >= width
    || startY >= height
  ) {
    return { data: input.data.slice(), changed: 0, bounds: null };
  }

  const result = input.data.slice();
  const target = pixelAt(result, width, startX, startY);
  const fill = { ...input.fill, a: input.fill.a ?? 255 };
  const tolerance = Math.max(0, Math.min(441, input.tolerance));

  if (rgbaDistance(target, fill) <= 1) {
    return { data: result, changed: 0, bounds: null };
  }

  const visited = new Uint8Array(width * height);
  const stack: Array<[number, number]> = [[startX, startY]];
  let changed = 0;
  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;

  while (stack.length) {
    const point = stack.pop();
    if (!point) continue;
    const [x, y] = point;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;

    const visitIdx = (y * width) + x;
    if (visited[visitIdx]) continue;
    visited[visitIdx] = 1;

    if (rgbaDistance(pixelAt(result, width, x, y), target) > tolerance) continue;

    setPixel(result, width, x, y, fill);
    changed += 1;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return {
    data: result,
    changed,
    bounds: changed ? { minX, minY, maxX, maxY } : null,
  };
}
