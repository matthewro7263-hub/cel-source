export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb | null {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function colorDistance(a: string, b: string): number {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const dr = left.r - right.r;
  const dg = left.g - right.g;
  const db = left.b - right.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function nearestPaletteColor(color: string, palette: string[]): { color: string; distance: number } {
  return palette.reduce(
    (best, candidate) => {
      const distance = colorDistance(color, candidate);
      return distance < best.distance ? { color: candidate, distance } : best;
    },
    { color: palette[0] || "#000000", distance: Number.POSITIVE_INFINITY },
  );
}

export function comparePaletteSimilarity(renderColors: string[], referenceColors: string[]): number {
  const validRender = renderColors.filter((color) => hexToRgb(color));
  const validReference = referenceColors.filter((color) => hexToRgb(color));
  if (!validRender.length || !validReference.length) return 0;
  const maxDistance = Math.sqrt(255 * 255 * 3);
  const averageDistance = validRender.reduce((sum, color) => {
    return sum + nearestPaletteColor(color, validReference).distance;
  }, 0) / validRender.length;
  return Math.max(0, Math.min(100, Math.round(100 - (averageDistance / maxDistance) * 100)));
}
