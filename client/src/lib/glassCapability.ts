export type GlassTier = "webgl" | "css" | "none";

export interface GlassCapability {
  tier: GlassTier;
  reducedMotion: boolean;
  webglAvailable: boolean;
  backdropFilter: boolean;
}

export const LIQUID_GL_TUNING = {
  snapshot: "#root",
  resolution: 1.5,
  refraction: 0.018,
  bevelDepth: 0.1,
  bevelWidth: 0.18,
  frost: 0.08,
  shadow: true,
  specular: true,
  reveal: "fade",
  tilt: false,
} as const;

let cachedCapability: GlassCapability | null = null;

function probeWebGL(): boolean {
  if (typeof window === "undefined") return false;
  if (window.__liquidGLNoWebGL__ === true) return false;
  const canvas = document.createElement("canvas");
  const ctx =
    canvas.getContext("webgl2") ||
    canvas.getContext("webgl") ||
    canvas.getContext("experimental-webgl");
  return !!ctx;
}

function probeBackdropFilter(): boolean {
  if (typeof window === "undefined") return false;
  return CSS.supports("backdrop-filter", "blur(1px)") ||
    CSS.supports("-webkit-backdrop-filter", "blur(1px)");
}

export function detectGlassCapability(): GlassCapability {
  if (cachedCapability) return cachedCapability;

  if (typeof window === "undefined") {
    cachedCapability = {
      tier: "none",
      reducedMotion: false,
      webglAvailable: false,
      backdropFilter: false,
    };
    return cachedCapability;
  }

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const webglAvailable = probeWebGL();
  const backdropFilter = probeBackdropFilter();

  let tier: GlassTier = "css";
  if (reducedMotion) {
    tier = "none";
  } else if (webglAvailable) {
    tier = "webgl";
  } else if (backdropFilter) {
    tier = "css";
  } else {
    tier = "none";
  }

  cachedCapability = {
    tier,
    reducedMotion,
    webglAvailable,
    backdropFilter,
  };
  return cachedCapability;
}

export function isProjectsRoute(location: string): boolean {
  return /\/projects\//.test(location);
}

export function shouldUseWebGL(location: string): boolean {
  const capability = detectGlassCapability();
  return capability.tier === "webgl" && !isProjectsRoute(location);
}

declare global {
  interface Window {
    __liquidGLNoWebGL__?: boolean;
  }
}