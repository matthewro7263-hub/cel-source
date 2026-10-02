/** Lazy-load native `@napi-rs/canvas` so the server can boot when bindings are missing (e.g. unsupported platform). */
let canvasModulePromise: Promise<typeof import("@napi-rs/canvas")> | null = null;

export async function getCanvasModule(): Promise<typeof import("@napi-rs/canvas")> {
  canvasModulePromise ??= import("@napi-rs/canvas");
  return canvasModulePromise;
}

export async function requireCanvasModule(): Promise<typeof import("@napi-rs/canvas") | null> {
  try {
    return await getCanvasModule();
  } catch {
    return null;
  }
}