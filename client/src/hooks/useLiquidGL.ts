import { useEffect, useRef, type MutableRefObject } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import {
  detectGlassCapability,
  LIQUID_GL_TUNING,
  shouldUseWebGL,
} from "@/lib/glassCapability";

declare global {
  interface Window {
    liquidGL?: ((opts: Record<string, unknown>) => unknown) & {
      destroy?: () => void;
      pause?: (paused?: boolean) => void;
      registerDynamic?: (elements: Element | Element[]) => void;
      syncWith?: (config?: Record<string, unknown>) => unknown;
    };
    __liquidGLNoWebGL__?: boolean;
    __liquidGLRenderer__?: { _destroyed?: boolean } | null;
  }
}

let liquidGLScriptsPromise: Promise<void> | null = null;

function loadLiquidGLScripts(): Promise<void> {
  if (typeof window.liquidGL === "function") return Promise.resolve();
  if (!liquidGLScriptsPromise) {
    liquidGLScriptsPromise = new Promise((resolve, reject) => {
      const loadScript = (src: string) =>
        new Promise<void>((res, rej) => {
          const script = document.createElement("script");
          script.src = src;
          script.defer = true;
          script.onload = () => res();
          script.onerror = () => rej(new Error(`Failed to load ${src}`));
          document.head.appendChild(script);
        });
      loadScript("/html2canvas.min.js")
        .then(() => loadScript("/liquidGL.js"))
        .then(() => resolve())
        .catch(reject);
    });
  }
  return liquidGLScriptsPromise;
}

export function clearLiquidReadyFlags(): void {
  document.querySelectorAll<HTMLElement>("[data-liquid-gl]").forEach((el) => {
    el.removeAttribute("data-liquid-ready");
    el.classList.remove("liquidGL-pending");
    el.removeAttribute("data-liquid-engine");
    el.classList.remove("liquid-glass-css-fallback");
  });
}

function applyCssDepthToHosts(): void {
  document.querySelectorAll<HTMLElement>("[data-liquid-gl='true']").forEach((el) => {
    el.classList.add("liquid-glass-host", "liquid-glass-depth");
    el.setAttribute("data-liquid-engine", "css");
  });
}

function applyOpaqueFallbackToHosts(): void {
  document.querySelectorAll<HTMLElement>("[data-liquid-gl='true']").forEach((el) => {
    el.classList.add("liquid-glass-host", "liquid-glass-depth", "liquid-glass-css-fallback");
    el.setAttribute("data-liquid-engine", "css");
  });
}

export function teardownLiquidGL(): void {
  window.liquidGL?.pause?.(true);
  window.liquidGL?.destroy?.();
  clearLiquidReadyFlags();
  applyCssDepthToHosts();
}

function isLiquidGLSuccess(result: unknown): boolean {
  if (result === undefined || result === null) return false;
  if (Array.isArray(result)) return result.length > 0;
  return true;
}

function markTargetsReady(targets: HTMLElement[], engine: "webgl" | "css"): void {
  targets.forEach((target) => {
    target.setAttribute("data-liquid-ready", "true");
    target.setAttribute("data-liquid-engine", engine);
    if (engine === "webgl") {
      target.classList.remove("liquid-glass-css-fallback");
    } else {
      target.classList.add("liquid-glass-css-fallback", "liquid-glass-depth");
    }
  });
}

function initBatch(
  selector: string,
  options: Record<string, unknown>,
): boolean {
  const targets = Array.from(
    document.querySelectorAll<HTMLElement>(`${selector}:not([data-liquid-ready='true'])`),
  );
  if (targets.length === 0) return true;

  targets.forEach((target) => {
    target.classList.add("liquidGL-pending");
    target.classList.add("liquid-glass-host");
  });

  try {
    if (typeof window.liquidGL !== "function") return false;

    const result = window.liquidGL({
      ...LIQUID_GL_TUNING,
      ...options,
      target: selector,
    });
    if (isLiquidGLSuccess(result)) {
      const engine = window.__liquidGLNoWebGL__ ? "css" : "webgl";
      markTargetsReady(targets, engine);
      return true;
    }
  } catch (error) {
    console.warn("liquidGL initialization failed; using CSS glass fallback.", error);
    markTargetsReady(targets, "css");
  } finally {
    targets.forEach((target) => target.classList.remove("liquidGL-pending"));
  }
  return false;
}

function initPendingTargets(): void {
  initBatch(".liquidGL-pending[data-liquid-tilt='true']", { tilt: true });
  initBatch(".liquidGL-pending:not([data-liquid-tilt='true'])", { tilt: false });
}

function scheduleInit(
  debounceRef: MutableRefObject<number | null>,
  frameRef: MutableRefObject<number>,
): void {
  const targets = Array.from(
    document.querySelectorAll<HTMLElement>("[data-liquid-gl='true']:not([data-liquid-ready='true'])"),
  );
  if (targets.length === 0) return;

  targets.forEach((target) => {
    target.classList.add("liquidGL-pending");
  });

  if (debounceRef.current) window.clearTimeout(debounceRef.current);
  debounceRef.current = window.setTimeout(() => {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      initPendingTargets();
    });
  }, 200);
}

/**
 * Initializes WebGL liquid glass on shell targets (`data-liquid-gl`).
 * Scripts load dynamically after mount. CSS depth fallback applies when
 * WebGL is unavailable or on `/projects/*` routes.
 */
export function useLiquidGL(): void {
  const [location] = useHashLocation();
  const debounceRef = useRef<number | null>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!shouldUseWebGL(location)) {
      teardownLiquidGL();
      return;
    }

    const capability = detectGlassCapability();
    if (capability.reducedMotion) {
      applyCssDepthToHosts();
      return;
    }

    if (!capability.backdropFilter) {
      applyOpaqueFallbackToHosts();
      return;
    }

    let cancelled = false;

    void loadLiquidGLScripts()
      .then(() => {
        if (cancelled) return;
        const renderer = window.__liquidGLRenderer__;
        const needsFreshInit = renderer == null || renderer._destroyed === true;
        if (needsFreshInit) clearLiquidReadyFlags();
        scheduleInit(debounceRef, frameRef);
      })
      .catch((error) => {
        console.warn("liquidGL scripts failed to load; using CSS glass fallback.", error);
        applyCssDepthToHosts();
      });

    const observer = new MutationObserver(() => {
      if (!cancelled) scheduleInit(debounceRef, frameRef);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      window.cancelAnimationFrame(frameRef.current);
      observer.disconnect();
    };
  }, [location]);
}