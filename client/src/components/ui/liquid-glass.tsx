"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useLiquidGlass, getOptimalGlassMode, GlassMode } from "@/lib/useLiquidGlass";

export type LiquidGlassDepth = "subtle" | "normal" | "strong";

const DEPTH_PRESETS: Record<
  LiquidGlassDepth,
  {
    displacement: number;
    chromaAmount: number;
    saturate: number;
    chromaOpacity: number;
    bevelOpacity: number;
    liftOpacity: number;
  }
> = {
  subtle: {
    displacement: 6,
    chromaAmount: 0.1,
    saturate: 165,
    chromaOpacity: 0.55,
    bevelOpacity: 0.5,
    liftOpacity: 0.35,
  },
  normal: {
    displacement: 10,
    chromaAmount: 0.16,
    saturate: 190,
    chromaOpacity: 0.75,
    bevelOpacity: 0.7,
    liftOpacity: 0.55,
  },
  strong: {
    displacement: 12,
    chromaAmount: 0.22,
    saturate: 210,
    chromaOpacity: 1,
    bevelOpacity: 0.9,
    liftOpacity: 0.75,
  },
};

interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /** Intensity of the glass shimmer (1-20, default from depth preset) */
  displacement?: number;
  borderRadius?: number;
  /** Iridescence intensity (0-1, default from depth preset) */
  chromaAmount?: number;
  active?: boolean;
  /** When true, enables simulated CSS refraction (backdrop-filter + depth layers). */
  refract?: boolean;
  /** Visual depth tier — subtle | normal | strong */
  depth?: LiquidGlassDepth;
  /**
   * When true, renders as an absolute inset-0 pointer-events-none decorative layer.
   * The caller is responsible for placing interactive content in a sibling with z-index.
   */
  overlay?: boolean;
  /** Refraction mode: 'css' for CSS-only, 'svg' for SVG filters, 'hybrid' for auto-detect */
  refractionMode?: GlassMode | 'hybrid';
  /** SVG filter specific options */
  lensW?: number;
  lensH?: number;
  scale?: number;
  followPointer?: boolean;
}

/**
 * LiquidGlass — Simulated glass refraction using layered CSS techniques and SVG filters.
 *
 * Produces a premium frosted-glass surface with backdrop blur, iridescent shimmer,
 * specular highlights, chromatic edge fringing, bevel depth, and lift shadows.
 * Supports CSS-only mode for performance and SVG-filter mode for true refraction.
 */
export const LiquidGlass = React.forwardRef<HTMLDivElement, LiquidGlassProps>(
  (
    {
      children,
      className,
      displacement,
      borderRadius,
      chromaAmount,
      active = true,
      refract = true,
      depth = "normal",
      overlay = false,
      refractionMode = "hybrid",
      lensW = 180,
      lensH = 112,
      scale = 48,
      followPointer = false,
      style,
      ...props
    },
    ref
  ) => {
    const preset = DEPTH_PRESETS[depth];
    const effectiveDisplacement = displacement ?? preset.displacement;
    const effectiveChroma = chromaAmount ?? preset.chromaAmount;
    const shouldRefract = active && refract;

    // Determine optimal glass mode
    const optimalMode = React.useMemo(() => {
      if (refractionMode === "hybrid") {
        return getOptimalGlassMode();
      }
      return refractionMode;
    }, [refractionMode]);

    const useSVG = optimalMode === "svg" && shouldRefract;
    const svgRef = React.useRef<HTMLDivElement>(null);
    const glassInstance = useLiquidGlass(
      svgRef,
      {
        lensW,
        lensH,
        borderRadius,
        scale,
        followPointer,
        active,
      },
      useSVG
    );

    const blurPx = Math.round(20 + (effectiveDisplacement / 20) * 24);
    const iridescenceOpacity = Math.min(1, effectiveChroma * 3);

    const depthLayers = shouldRefract && !useSVG ? (
      <>
        <span
          className="liquid-glass-shimmer"
          style={{ opacity: iridescenceOpacity * preset.chromaOpacity }}
        />
        <span
          className="liquid-glass-chroma"
          style={{ opacity: preset.chromaOpacity }}
        />
        <span
          className="liquid-glass-bevel"
          style={{ opacity: preset.bevelOpacity }}
        />
        <span className="liquid-glass-specular" />
        <span
          className="liquid-glass-lift"
          style={{ opacity: preset.liftOpacity }}
        />
        <span className="liquid-glass-edge" />
      </>
    ) : null;

    if (overlay) {
      return (
        <div
          ref={useSVG ? svgRef : ref}
          data-glass-depth={depth}
          className={cn(
            "absolute inset-0 z-0 overflow-hidden pointer-events-none liquid-glass-host",
            shouldRefract && !useSVG ? "liquid-glass-surface liquid-glass-depth" : "glass",
            useSVG ? "lgk-liquid-glass" : "",
            className
          )}
          style={{
            ...style,
            ...(borderRadius !== undefined ? { borderRadius } : {}),
            ...(shouldRefract && !useSVG
              ? {
                  backdropFilter: `blur(${blurPx}px) saturate(${preset.saturate}%)`,
                  WebkitBackdropFilter: `blur(${blurPx}px) saturate(${preset.saturate}%)`,
                }
              : {}),
          }}
          aria-hidden="true"
          {...props}
        >
          {depthLayers}
          {children}
        </div>
      );
    }

    return (
      <div
        ref={useSVG ? svgRef : ref}
        data-glass-depth={depth}
        className={cn(
          "relative overflow-hidden liquid-glass-host",
          shouldRefract && !useSVG ? "liquid-glass-surface liquid-glass-depth" : "glass",
          useSVG ? "lgk-liquid-glass" : "",
          className
        )}
        style={{
          ...style,
          ...(borderRadius !== undefined ? { borderRadius } : {}),
          ...(shouldRefract && !useSVG
            ? {
                backdropFilter: `blur(${blurPx}px) saturate(${preset.saturate}%)`,
                WebkitBackdropFilter: `blur(${blurPx}px) saturate(${preset.saturate}%)`,
              }
            : {}),
        }}
        {...props}
      >
        {depthLayers}
        <div className="relative z-[2]">{children}</div>
      </div>
    );
  }
);
LiquidGlass.displayName = "LiquidGlass";

/**
 * Simpler CSS-only glass surface for high-performance areas
 * where the full animated shimmer isn't needed.
 */
export const GlassSurface = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative overflow-hidden liquid-glass-host",
      "bg-[var(--surface-1)] dark:bg-white/10",
      "backdrop-blur-2xl backdrop-saturate-[170%]",
      "border border-[var(--card-border)] dark:border-white/14",
      "shadow-[var(--shadow-soft)]",
      "rounded-2xl",
      className
    )}
    {...props}
  >
    <div className="relative z-[1] h-full">{children}</div>
  </div>
));
GlassSurface.displayName = "GlassSurface";

export interface LiquidGlassCardProps extends Omit<LiquidGlassProps, "overlay"> {
  glassClass?: "glass" | "glass-strong";
}

export const LiquidGlassCard = React.forwardRef<HTMLDivElement, LiquidGlassCardProps>(
  (
    {
      children,
      className,
      glassClass = "glass-strong",
      refract = true,
      depth = "normal",
      displacement,
      ...liquidProps
    },
    ref
  ) => (
    <div ref={ref} className={cn("relative rounded-2xl liquid-glass-host", className)}>
      <LiquidGlass
        overlay
        refract={refract}
        depth={depth}
        displacement={displacement}
        className={cn("rounded-[inherit]", refract ? "" : glassClass)}
        {...liquidProps}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  )
);
LiquidGlassCard.displayName = "LiquidGlassCard";