import { useEffect, useRef, useCallback } from 'react';
// @ts-ignore - TypeScript declarations are in liquid-glass-kit.d.ts
import { LiquidGlass as LiquidGlassClass } from './liquid-glass-kit.js';

export interface LiquidGlassOptions {
  lensW?: number;
  lensH?: number;
  borderRadius?: number;
  x?: number;
  y?: number;
  scale?: number;
  depth?: number;
  curvature?: number;
  splay?: number;
  chroma?: number;
  blur?: number;
  glow?: number;
  edge?: number;
  specularAngle?: number;
  followPointer?: boolean;
  fit?: 'inline' | 'block';
  active?: boolean;
}

export interface LiquidGlassInstance {
  setPosition: (x: number, y?: number) => void;
  update: (options: Partial<LiquidGlassOptions>) => void;
  setActive: (active: boolean) => void;
  setLensOpacity: (opacity: number) => void;
  setTransform: (transform: { lift?: number; stretchX?: number; stretchY?: number }) => void;
  enableDrag: (options?: { onMove?: (x: number, y: number) => void }) => void;
  destroy: () => void;
}

/**
 * React hook for managing LiquidGlass instances with automatic cleanup
 * @param ref - React ref to the DOM element
 * @param options - LiquidGlass configuration options
 * @param enabled - Whether the effect should be active (for conditional rendering)
 * @returns LiquidGlass instance methods or null if not enabled
 */
export function useLiquidGlass(
  ref: React.RefObject<HTMLElement>,
  options: LiquidGlassOptions = {},
  enabled: boolean = true
): LiquidGlassInstance | null {
  const instanceRef = useRef<LiquidGlassClass | null>(null);

  // Initialize LiquidGlass instance
  useEffect(() => {
    if (!ref.current || !enabled) return;

    try {
      const instance = new LiquidGlassClass(ref.current, options);
      instanceRef.current = instance;
    } catch (error) {
      console.warn('Failed to initialize LiquidGlass:', error);
    }

    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (error) {
          console.warn('Failed to destroy LiquidGlass:', error);
        }
        instanceRef.current = null;
      }
    };
  }, [enabled]); // Only re-run on enabled change

  // Update options when they change
  useEffect(() => {
    if (!instanceRef.current || !enabled) return;

    const needsRegenerate = [
      'lensW', 'lensH', 'borderRadius', 'scale', 'depth', 'curvature', 'splay', 'chroma'
    ].some((key) => key in options);

    try {
      if (needsRegenerate) {
        instanceRef.current.update(options);
      }
    } catch (error) {
      console.warn('Failed to update LiquidGlass:', error);
    }
  }, [options, enabled]);

  // Memoize instance methods
  const setPosition = useCallback((x: number, y?: number) => {
    if (instanceRef.current) {
      instanceRef.current.setPosition(x, y);
    }
  }, []);

  const update = useCallback((newOptions: Partial<LiquidGlassOptions>) => {
    if (instanceRef.current) {
      instanceRef.current.update(newOptions);
    }
  }, []);

  const setActive = useCallback((active: boolean) => {
    if (instanceRef.current) {
      instanceRef.current.setActive(active);
    }
  }, []);

  const setLensOpacity = useCallback((opacity: number) => {
    if (instanceRef.current) {
      instanceRef.current.setLensOpacity(opacity);
    }
  }, []);

  const setTransform = useCallback((transform: { lift?: number; stretchX?: number; stretchY?: number }) => {
    if (instanceRef.current) {
      instanceRef.current.setTransform(transform);
    }
  }, []);

  const enableDrag = useCallback((dragOptions?: { onMove?: (x: number, y: number) => void }) => {
    if (instanceRef.current) {
      instanceRef.current.enableDrag(dragOptions);
    }
  }, []);

  const destroy = useCallback(() => {
    if (instanceRef.current) {
      instanceRef.current.destroy();
      instanceRef.current = null;
    }
  }, []);

  if (!enabled) {
    return null;
  }

  return {
    setPosition,
    update,
    setActive,
    setLensOpacity,
    setTransform,
    enableDrag,
    destroy,
  };
}

/**
 * Feature detection for Liquid Glass Kit capabilities
 */
export const supportsSVGFilters = (): boolean => {
  if (typeof SVGFEColorMatrixElement === 'undefined') return false;
  try {
    const testFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    return 'feDisplacementMap' in testFilter;
  } catch {
    return false;
  }
};

export const supportsBackdropFilter = (): boolean => {
  return (
    CSS.supports('backdrop-filter', 'blur(1px)') ||
    CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
  );
};

export const supportsPointerEvents = (): boolean => {
  return 'onpointerdown' in window;
};

export const isReducedMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const isMobileDevice = (): boolean => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

/**
 * Determine if SVG refraction should be used based on capabilities and preferences
 */
export const shouldUseSVGRefraction = (): boolean => {
  return (
    supportsSVGFilters() &&
    !isReducedMotion() &&
    !isMobileDevice() // Optional: disable on mobile for performance
  );
};

/**
 * Get the appropriate glass mode based on browser capabilities
 */
export type GlassMode = 'svg' | 'css' | 'basic';

export const getOptimalGlassMode = (): GlassMode => {
  if (shouldUseSVGRefraction()) {
    return 'svg';
  }
  if (supportsBackdropFilter()) {
    return 'css';
  }
  return 'basic';
};
