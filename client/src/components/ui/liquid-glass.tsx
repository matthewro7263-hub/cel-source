"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { generateLensMap, getFreshFilterId, refreshFilter } from "@/lib/glass-utils";

interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  displacement?: number;
  borderRadius?: number;
  chromaAmount?: number;
  active?: boolean;
  /** When true, uses the full SVG displacement filter. When false, uses enhanced CSS glass. */
  refract?: boolean;
}

/**
 * LiquidGlass — Cross-browser glass refraction effect.
 *
 * Technique: SVG feDisplacementMap with a dynamically-generated map.
 * Works on live DOM: text stays selectable, links stay clickable.
 * Falls back to enhanced CSS glass on Safari when SVG filters are limited
 * or when `refract={false}`.
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
      style,
      ...props
    },
    ref
  ) => {
    const innerRef = React.useRef<HTMLDivElement>(null);
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref]
    );

    const [filterId, setFilterId] = React.useState<string>("");
    const [mapUrl, setMapUrl] = React.useState<string>("");
    const [dimensions, setDimensions] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });

    // Generate filter on mount / resize
    React.useEffect(() => {
      if (!active || !refract) return;

      const el = innerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const w = Math.max(32, Math.round(rect.width));
      const h = Math.max(32, Math.round(rect.height));

      if (w !== dimensions.w || h !== dimensions.h) {
        setDimensions({ w, h });
        const id = getFreshFilterId();
        setFilterId(id);
        const url = generateLensMap({
          width: w,
          height: h,
          borderRadius: borderRadius ?? Math.min(w, h) * 0.2,
          strength: displacement / 128,
          chromaAmount,
        });
        setMapUrl(url);
      }
    }, [active, refract, displacement, borderRadius, chromaAmount, dimensions.w, dimensions.h]);

    // Safari fix: refresh filter when content changes
    React.useEffect(() => {
      if (!active || !refract || !filterId) return;
      const el = innerRef.current;
      if (!el) return;

      const observer = new MutationObserver(() => refreshFilter(el));
      observer.observe(el, { childList: true, subtree: true, attributes: true });
      return () => observer.disconnect();
    }, [active, refract, filterId]);

    const isChromium =
      typeof navigator !== "undefined" &&
      /Chrome|Chromium|Edg|Opera/.test(navigator.userAgent) &&
      !/Safari/.test(navigator.userAgent);

    // On non-Chromium browsers, limit filter area for performance
    const filterRegion = isChromium ? undefined : "10%";

    return (
      <div
        ref={setRefs}
        className={cn(
          "relative overflow-hidden",
          // Always apply the enhanced CSS glass base
          "bg-surface-1/80 dark:bg-white/10 backdrop-blur-2xl backdrop-saturate-[170%]",
          "border border-white/20 dark:border-white/20",
          "shadow-[var(--shadow-soft)]",
          className
        )}
        style={{
          ...style,
          ...(active && refract && filterId
            ? { filter: `url(#${filterId})` }
            : {}),
        }}
        {...props}
      >
        {/* SVG filter definition — absolute 0x0 so it doesn't affect layout */}
        {active && refract && filterId && mapUrl && (
          <svg
            className="absolute"
            style={{ width: 0, height: 0, overflow: "hidden" }}
            aria-hidden="true"
          >
            <defs>
              <filter
                id={filterId}
                x={filterRegion ? "-10%" : "0%"}
                y={filterRegion ? "-10%" : "0%"}
                width={filterRegion ? "120%" : "100%"}
                height={filterRegion ? "120%" : "100%"}
                colorInterpolationFilters="sRGB"
              >
                {/* Displacement map input */}
                <feImage href={mapUrl} result="displacementMap" />

                {/* Main displacement */}
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="displacementMap"
                  scale={displacement}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="displaced"
                />

                {/* Subtle chromatic aberration at edges */}
                <feColorMatrix
                  in="displaced"
                  type="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
                  result="colorCorrected"
                />

                {/* Specular highlight pass */}
                <feGaussianBlur
                  in="displacementMap"
                  stdDeviation="2"
                  result="blurredMap"
                />
                <feSpecularLighting
                  in="blurredMap"
                  surfaceScale="2"
                  specularConstant="0.6"
                  specularExponent="20"
                  lightingColor="white"
                  result="specular"
                >
                  <fePointLight x={-50} y={-50} z="100" />
                </feSpecularLighting>
                <feComposite
                  in="specular"
                  in2="colorCorrected"
                  operator="arithmetic"
                  k1="0"
                  k2="1"
                  k3="0.3"
                  k4="0"
                  result="lit"
                />

                {/* Blend back with original for legibility */}
                <feBlend
                  in="lit"
                  in2="SourceGraphic"
                  mode="normal"
                  result="blended"
                />

                {/* Final subtle contrast boost */}
                <feComponentTransfer in="blended">
                  <feFuncR type="gamma" amplitude="1.02" exponent="0.95" offset="0" />
                  <feFuncG type="gamma" amplitude="1.02" exponent="0.95" offset="0" />
                  <feFuncB type="gamma" amplitude="1.02" exponent="0.95" offset="0" />
                </feComponentTransfer>
              </filter>
            </defs>
          </svg>
        )}

        {/* Content wrapper — keeps children interactive */}
        <div className="relative z-[1]">{children}</div>
      </div>
    );
  }
);
LiquidGlass.displayName = "LiquidGlass";

/**
 * Simpler CSS-only glass surface for high-performance areas
 * where the full SVG filter isn't needed.
 */
export const GlassSurface = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative overflow-hidden",
      "bg-[var(--surface-1)] dark:bg-white/10 backdrop-blur-2xl backdrop-saturate-[170%]",
      "border border-[var(--card-border)] dark:border-white/20",
      "shadow-[var(--shadow-soft)]",
      className
    )}
    {...props}
  >
    <div className="relative z-[1] h-full">{children}</div>
  </div>
));
GlassSurface.displayName = "GlassSurface";
