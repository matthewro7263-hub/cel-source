import { forwardRef } from "react";
import { MetalFx } from "metal-fx";
import { GlassButton, GlassButtonProps } from "./glass-button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * MetalGlassButton — a GlassButton wrapped in metal-fx (WebGL liquid-metal ring)
 * but ONLY when the app is in dark mode. In light mode it renders an unwrapped
 * GlassButton.
 *
 * Layout notes (important to avoid "trapped in a box" clipping):
 *  • The MetalFx wrapper is inline-flex by default. If the caller passes
 *    `w-full`, we promote the wrapper to `flex w-full` and let the inner
 *    GlassButton fill it. This fixes the centering bug where a `w-full`
 *    button was rendered inside a shrunken inline wrapper.
 *  • The metal-fx shader paints OUTSIDE the button silhouette. If an
 *    ancestor uses `overflow: hidden` or `backdrop-filter`, the glow gets
 *    clipped. For containers like `.glass` cards with backdrop-filter, the
 *    caller should set `noMetal` or place the button outside the glass
 *    container. Padding/margins on the wrapper itself give the glow room
 *    to breathe at the edges (controlled via `bleed` prop).
 */
export interface MetalGlassButtonProps extends GlassButtonProps {
  preset?: "silver" | "gold" | "chromatic";
  metalVariant?: "button" | "circle";
  alwaysMetal?: boolean;
  noMetal?: boolean;
  /** Extra invisible padding around the wrapper so the metal glow has room
   *  to extend without being clipped by adjacent layout. Default 6px. */
  bleed?: number;
}

export const MetalGlassButton = forwardRef<HTMLButtonElement, MetalGlassButtonProps>(
  ({ preset = "silver", metalVariant = "button", alwaysMetal = false, noMetal = false, bleed = 6, className, ...props }, ref) => {
    const { theme } = useTheme();
    const showMetal = !noMetal && (alwaysMetal || theme === "dark");

    if (!showMetal) {
      return <GlassButton ref={ref} className={className} {...props} />;
    }

    // Detect if caller wants full-width — promote wrapper accordingly so the
    // inner GlassButton stays centered and fills available width.
    const isFullWidth = typeof className === "string" && /\bw-full\b/.test(className);
    const innerClassName = className;
    const wrapperClassName = cn(
      "metal-fx-wrapper align-middle",
      isFullWidth ? "flex w-full [&>.metal-fx-content]:w-full" : "inline-flex"
    );

    return (
      <MetalFx
        variant={metalVariant}
        preset={preset}
        theme="dark"
        className={wrapperClassName}
        style={{ padding: bleed, borderRadius: 9999 }}
      >
        <GlassButton ref={ref} className={cn(innerClassName, isFullWidth && "w-full")} {...props} />
      </MetalFx>
    );
  }
);
MetalGlassButton.displayName = "MetalGlassButton";
