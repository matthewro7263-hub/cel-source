/**
 * Aave-style glass displacement map generator
 * Creates a PNG displacement map for SVG feDisplacementMap filters
 * that refract live HTML content through a curved glass lens.
 */

export interface LensMapOptions {
  width: number;
  height: number;
  borderRadius?: number;
  strength?: number; // 0-1, default 0.06
  chromaAmount?: number; // 0-1, default 0.12
}

/**
 * Generate a displacement map for a rounded-rect lens.
 * Red channel = X displacement, Green = Y displacement.
 * 128 is neutral (no displacement). Values above/below push pixels.
 */
export function generateLensMap(opts: LensMapOptions): string {
  const {
    width,
    height,
    borderRadius = Math.min(width, height) * 0.25,
    strength = 0.06,
    chromaAmount = 0.12,
  } = opts;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(cx, cy);

  // Four-fold symmetry optimization: compute top-left quadrant, mirror to rest
  const qw = Math.ceil(width / 2);
  const qh = Math.ceil(height / 2);

  for (let y = 0; y < qh; y++) {
    for (let x = 0; x < qw; x++) {
      // Distance from center
      const dx = x - cx + (width % 2 === 0 ? 0.5 : 0);
      const dy = y - cy + (height % 2 === 0 ? 0.5 : 0);

      // Signed distance to rounded-rect shape
      const rx = Math.max(0, Math.abs(dx) - (cx - borderRadius));
      const ry = Math.max(0, Math.abs(dy) - (cy - borderRadius));
      const dist = Math.sqrt(rx * rx + ry * ry) - borderRadius;

      // Inside the lens: compute displacement
      // Normalized position from center (-1 to 1)
      const nx = dx / maxR;
      const ny = dy / maxR;
      const nDist = Math.sqrt(nx * nx + ny * ny);

      // Lens curve: stronger displacement near edges, neutral at center
      // Using a parabolic lens profile
      let lensFactor = 0;
      if (dist < 0) {
        // Inside lens
        const t = Math.min(1, -dist / borderRadius);
        lensFactor = t * t * (3 - 2 * t); // smoothstep
      }

      // Displacement magnitude
      const disp = lensFactor * strength;

      // Displacement direction: outward from center
      const dispX = nx * disp;
      const dispY = ny * disp;

      // Chromatic offset: slight color fringe at edges
      const chroma = lensFactor * chromaAmount;

      // Convert to 0-255 range (128 = neutral)
      const r = Math.floor(128 + dispX * 127 + chroma * 30);
      const g = Math.floor(128 + dispY * 127);
      const b = Math.floor(128 - chroma * 30);

      // Write to all four quadrants
      const write = (px: number, py: number, rr: number, gg: number, bb: number) => {
        if (px < 0 || px >= width || py < 0 || py >= height) return;
        const idx = (py * width + px) * 4;
        data[idx] = Math.max(0, Math.min(255, rr));
        data[idx + 1] = Math.max(0, Math.min(255, gg));
        data[idx + 2] = Math.max(0, Math.min(255, bb));
        data[idx + 3] = 255;
      };

      write(x, y, r, g, b);
      write(width - 1 - x, y, 255 - r, g, b); // mirror X
      write(x, height - 1 - y, r, 255 - g, b); // mirror Y
      write(width - 1 - x, height - 1 - y, 255 - r, 255 - g, b); // mirror XY
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

let filterIdCounter = 0;

export function getFreshFilterId(): string {
  return `cel-glass-${Date.now()}-${++filterIdCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Safari-safe filter application.
 * Safari caches SVG filters by ID; changing the ID forces a re-render.
 */
export function refreshFilter(el: HTMLElement | null) {
  if (!el) return;
  const filterVal = el.style.filter;
  if (!filterVal.includes("url(#")) return;

  // Force repaint
  el.style.filter = "none";
  requestAnimationFrame(() => {
    el.style.filter = filterVal;
  });
}
