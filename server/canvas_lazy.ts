/** Lazy-load native `canvas` so the server can boot when bindings are missing (e.g. local dev). */
let canvasModulePromise: Promise<typeof import("canvas")> | null = null;

export async function getCanvasModule(): Promise<typeof import("canvas")> {
  canvasModulePromise ??= import("canvas");
  return canvasModulePromise;
}

export async function requireCanvasModule(): Promise<typeof import("canvas") | null> {
  try {
    return await getCanvasModule();
  } catch {
    return null;
  }
}