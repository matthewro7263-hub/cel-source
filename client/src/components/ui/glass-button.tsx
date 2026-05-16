import { ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * GlassButton — Liquid Glass Neumorphic design system
 *
 * Three variants matching the reference images:
 *
 * 1. primary   — Frosted glass circle/pill with iridescent holographic sheen,
 *                physically raised via neumorphic shadow stack.
 *                Translucent white surface with backdrop-blur.
 * 2. ghost     — Frosted glass surface, subtle shadow, clean hover state
 * 3. toolbar   — Inline icon button for glass pill toolbars, minimal chrome
 *
 * Sizes:
 *   pill  — rounded-full, padded (primary CTA)
 *   round — rounded-full aspect-square w-12 (circular icon-only FAB)
 *   sm    — compact rounded-xl (secondary actions)
 *   md    — default
 *
 * Uses neumorphic shadows for depth instead of translateY.
 * Active states use subtle scale + pressed shadow.
 */
const glassButtonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2",
    "isolate overflow-hidden",
    "font-semibold select-none cursor-pointer",
    "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
    "active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
  ],
  {
    variants: {
      variant: {
        /**
         * Primary — Liquid glass with iridescent sheen.
         * Frosted translucent surface with neumorphic shadow stack.
         * Subtle conic-gradient overlay for holographic iridescence.
         */
        primary: [
          "text-foreground tracking-wide",
          "bg-[var(--neu-glass-bg)]",
          "backdrop-blur-[26px] backdrop-saturate-[175%]",
          "border border-[var(--neu-glass-border)]",
          "shadow-[var(--neu-shadow-caustic-raised)]",
          "hover:bg-[var(--neu-glass-bg-hover)]",
          "hover:border-[var(--neu-glass-border-hover)]",
          "hover:shadow-[var(--neu-shadow-raised-hover)]",
          "hover:translate-y-[-0.5px]",
          "active:bg-[var(--neu-glass-bg-active)]",
          "active:shadow-[var(--neu-shadow-pressed)]",
          "active:translate-y-0",
        ],
        /**
         * Ghost — transparent until hover, then frosted glass appears
         */
        ghost: [
          "text-muted-foreground",
          "bg-transparent",
          "border border-transparent",
          "hover:bg-[var(--neu-glass-bg)]",
          "hover:backdrop-blur-[26px] hover:backdrop-saturate-[175%]",
          "hover:border-[var(--neu-glass-border)]",
          "hover:shadow-[var(--neu-shadow-caustic-raised)]",
          "hover:text-foreground",
          "active:shadow-[var(--neu-shadow-pressed)]",
        ],
        /**
         * Toolbar icon button — minimal, used inside GlassToolbar
         */
        toolbar: [
          "text-[var(--neu-icon-muted)]",
          "hover:text-[var(--neu-icon-color)]",
          "hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.08)]",
          "rounded-lg",
          "transition-colors duration-150",
        ],
      },
      size: {
        pill: "rounded-full px-7 py-2.5 text-sm",
        round: "rounded-full w-14 h-14 text-base shadow-[0_1px_1px_rgba(16,24,40,0.05),0_8px_18px_rgba(16,24,40,0.12),0_24px_40px_rgba(16,24,40,0.14),-10px_-8px_26px_rgba(255,255,255,0.82),inset_0_1px_1px_rgba(255,255,255,0.98),inset_0_-1px_1px_rgba(88,96,120,0.08)]",
        sm: "rounded-xl px-4 py-1.5 text-xs",
        md: "rounded-xl px-5 py-2 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface GlassButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, size, children, style, ...props }, ref) => {
    const resolvedVariant = variant ?? "primary";
    const resolvedSize = size ?? "md";
    const showOptics = resolvedVariant !== "toolbar";
    const materialStyle = showOptics
      ? {
          background:
            resolvedVariant === "primary"
              ? "var(--neu-glass-material), var(--neu-glass-bg)"
              : resolvedVariant === "ghost"
                ? "transparent"
                : "var(--neu-glass-bg)",
          boxShadow: resolvedVariant === "ghost" ? undefined : "var(--neu-shadow-caustic-raised)",
        }
      : undefined;

    return (
      <button
        ref={ref}
        className={cn(glassButtonVariants({ variant, size }), className)}
        data-variant={variant ?? "default"}
        data-caustic-glass={showOptics ? "" : undefined}
        data-glass-size={size ?? "md"}
        style={{ ...materialStyle, ...style }}
        {...props}
      >
        {showOptics && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-95"
              style={{
                background: resolvedVariant === "primary" ? "var(--neu-glass-material), var(--neu-glass-bg)" : "var(--neu-glass-bg)",
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-60 blur-[8px] transition-opacity duration-200"
              style={{
                background: "var(--neu-glass-caustic)",
                transform: resolvedSize === "round" ? "scale(0.72)" : "scale(0.82)",
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] border border-transparent opacity-75 transition-opacity duration-200"
              style={{
                backgroundImage: "linear-gradient(var(--neu-glass-rim), var(--neu-glass-rim)), var(--neu-glass-refraction)",
                backgroundOrigin: "border-box",
                backgroundClip: "padding-box, border-box",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.86), inset 0 -1px 1px rgba(84,94,118,0.08)",
              }}
            />
          </>
        )}
        <span className="relative z-[2] inline-flex items-center gap-2">
          {children}
        </span>
      </button>
    );
  }
);
GlassButton.displayName = "GlassButton";

/**
 * GlassToolbar — Liquid glass neumorphic pill container for icon buttons
 * Matches reference image: frosted capsule-shaped container with raised shadow,
 * translucent white surface, hairline dividers between children.
 *
 * Usage: <GlassToolbar><GlassButton variant="toolbar">…</GlassButton></GlassToolbar>
 */
export function GlassToolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0 px-2 py-1.5 rounded-full",
        // Frosted glass surface
        "bg-[rgba(255,255,255,0.60)] dark:bg-[rgba(255,255,255,0.07)]",
        "backdrop-blur-[24px] backdrop-saturate-[170%]",
        // Glass rim border
        "border border-[rgba(255,255,255,0.65)] dark:border-[rgba(255,255,255,0.10)]",
        // Neumorphic shadow — raised pill with caustic light core
        "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_3px_6px_rgba(0,0,0,0.10),0_6px_14px_rgba(0,0,0,0.08),0_2px_10px_rgba(255,255,255,0.55),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(0,0,0,0.04)]",
        "dark:shadow-[0_1px_2px_rgba(0,0,0,0.18),0_3px_6px_rgba(0,0,0,0.24),0_6px_14px_rgba(0,0,0,0.18),0_2px_10px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.22)]",
        // Hairline dividers between children
        "[&>*+*]:border-l [&>*+*]:border-[rgba(0,0,0,0.06)] dark:[&>*+*]:border-[rgba(255,255,255,0.08)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export default GlassButton;
