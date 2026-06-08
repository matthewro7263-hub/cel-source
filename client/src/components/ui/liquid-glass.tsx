"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /** Intensity of the glass refraction shimmer (1-20, default 8) */
  displacement?: number;
  borderRadius?: number;
  /** Iridescence intensity (0-1, default 0.12) */
  chromaAmount?: number;
  active?: boolean;
  /** When true, enables the full liquid glass refraction effect. When false, uses basic CSS glass. */
  refract?: boolean;
  /**
   * When true, renders as an absolute inset-0 pointer-events-none decorative layer.
   * The caller is responsible for placing interactive content in a sibling with z-index.
   * This avoids the glass overlay intercepting pointer events on buttons, inputs, etc.
   */
  overlay?: boolean;
}

/**
 * LiquidGlass — Liquid glass refraction effect using layered CSS techniques.
 *
 * Produces a premium frosted-glass surface with:
 * - Strong backdrop-filter blur for real background refraction
 * - Animated iridescent shimmer via conic-gradient
 * - Specular highlight simulation (top-left light source)
 * - Edge-light refraction border glow
 * - Caustic light bloom on hover
 *
 * Falls back to enhanced CSS glass when `refract={false}` or `active={false}`.
 */
export const LiquidGlass = React.forwardRef<HTMLDivElement, LiquidGlassProps>(
  (
    {
      children,
      className,
      displacement = 8,
      borderRadius,
      chromaAmount = 0.12,
      active = true,
      refract = true,
      overlay = false,
      style,
      ...props
    },
    ref
  ) => {
    const shouldRefract = active && refract;

    // Map displacement (1-20) to blur intensity (20-44px)
    const blurPx = Math.round(20 + (displacement / 20) * 24);
    // Map chromaAmount to iridescence opacity
    const iridescenceOpacity = Math.min(1, chromaAmount * 3);

    // Overlay mode: absolute decorative background, no children wrapper
    if (overlay) {
      return (
        <div
          ref={ref}
          className={cn(
            "absolute inset-0 overflow-hidden pointer-events-none",
            shouldRefract ? "liquid-glass-surface" : "glass",
            className
          )}
          style={{
            ...style,
            ...(borderRadius !== undefined ? { borderRadius } : {}),
            ...(shouldRefract
              ? {
                  backdropFilter: `blur(${blurPx}px) saturate(180%)`,
                  WebkitBackdropFilter: `blur(${blurPx}px) saturate(180%)`,
                }
              : {}),
          }}
          aria-hidden="true"
          {...props}
        >
          {shouldRefract && (
            <>
              {/* Iridescent shimmer layer */}
              <span
                className="liquid-glass-shimmer"
                style={{ opacity: iridescenceOpacity }}
              />
              {/* Specular highlight — top-left light source */}
              <span className="liquid-glass-specular" />
              {/* Edge-light refraction glow */}
              <span className="liquid-glass-edge" />
            </>
          )}
        </div>
      );
    }

    // Standard mode: wraps children with glass + effects
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          shouldRefract ? "liquid-glass-surface" : "glass",
          className
        )}
        style={{
          ...style,
          ...(borderRadius !== undefined ? { borderRadius } : {}),
          ...(shouldRefract
            ? {
                backdropFilter: `blur(${blurPx}px) saturate(180%)`,
                WebkitBackdropFilter: `blur(${blurPx}px) saturate(180%)`,
              }
            : {}),
        }}
        {...props}
      >
        {shouldRefract && (
          <>
            <span
              className="liquid-glass-shimmer"
              style={{ opacity: iridescenceOpacity }}
            />
            <span className="liquid-glass-specular" />
            <span className="liquid-glass-edge" />
          </>
        )}

        {/* Content wrapper — keeps children interactive above glass layers */}
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
      "relative overflow-hidden",
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

/**
 * LiquidGlassCard — Convenience wrapper that composes LiquidGlass overlay
 * with a relative content container. Safe for interactive content (buttons,
 * links, inputs) because the glass effects are on a pointer-events-none layer.
 *
 * Usage:
 *   <LiquidGlassCard refract displacement={4} className="rounded-2xl">
 *     <h2>Title</h2>
 *     <Button>Click me</Button>
 *   </LiquidGlassCard>
 */
export interface LiquidGlassCardProps extends Omit<LiquidGlassProps, "overlay"> {
  /** Glass CSS class fallback for when refract is false */
  glassClass?: "glass" | "glass-strong";
}

export const LiquidGlassCard = React.forwardRef<HTMLDivElement, LiquidGlassCardProps>(
  (
    {
      children,
      className,
      glassClass = "glass-strong",
      refract = true,
      ...liquidProps
    },
    ref
  ) => (
    <div ref={ref} className={cn("relative rounded-2xl", className)}>
      <LiquidGlass
        overlay
        refract={refract}
        className={cn("rounded-[inherit]", refract ? "" : glassClass)}
        {...liquidProps}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  )
);
LiquidGlassCard.displayName = "LiquidGlassCard";
