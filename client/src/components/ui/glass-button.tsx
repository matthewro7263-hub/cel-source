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
    "font-semibold select-none cursor-pointer",
    "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
    "active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
    "overflow-visible",
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
          // Frosted glass surface
          "bg-[rgba(255,255,255,0.60)] dark:bg-[rgba(255,255,255,0.08)]",
          "backdrop-blur-[20px] backdrop-saturate-[160%]",
          // Glass rim border
          "border border-[rgba(255,255,255,0.65)] dark:border-[rgba(255,255,255,0.12)]",
          // Neumorphic shadow stack — raised feel with caustic white core
          "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_3px_6px_rgba(0,0,0,0.10),0_6px_14px_rgba(0,0,0,0.08),0_2px_8px_rgba(255,255,255,0.50),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(0,0,0,0.04)]",
          // Dark mode shadow
          "dark:shadow-[0_1px_2px_rgba(0,0,0,0.18),0_3px_6px_rgba(0,0,0,0.24),0_6px_14px_rgba(0,0,0,0.18),0_2px_8px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.22)]",
          // Hover — glass brightens, shadow deepens with stronger caustic
          "hover:bg-[rgba(255,255,255,0.75)] dark:hover:bg-[rgba(255,255,255,0.12)]",
          "hover:border-[rgba(255,255,255,0.85)] dark:hover:border-[rgba(255,255,255,0.18)]",
          "hover:shadow-[0_2px_3px_rgba(0,0,0,0.08),0_4px_10px_rgba(0,0,0,0.12),0_10px_20px_rgba(0,0,0,0.08),0_3px_12px_rgba(255,255,255,0.60),inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(0,0,0,0.05)]",
          "hover:translate-y-[-0.5px]",
          // Active — pressed in
          "active:bg-[rgba(255,255,255,0.50)] dark:active:bg-[rgba(255,255,255,0.05)]",
          "active:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_4px_rgba(255,255,255,0.30),inset_0_2px_4px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(0,0,0,0.06)]",
          "active:translate-y-0",
        ],
        /**
         * Ghost — transparent until hover, then frosted glass appears
         */
        ghost: [
          "text-muted-foreground",
          "bg-transparent",
          "border border-transparent",
          // Hover: glass materializes
          "hover:bg-[rgba(255,255,255,0.55)] dark:hover:bg-[rgba(255,255,255,0.06)]",
          "hover:backdrop-blur-[20px] hover:backdrop-saturate-[160%]",
          "hover:border-[rgba(255,255,255,0.60)] dark:hover:border-[rgba(255,255,255,0.10)]",
          "hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_3px_6px_rgba(0,0,0,0.10),0_6px_14px_rgba(0,0,0,0.08),0_2px_8px_rgba(255,255,255,0.50),inset_0_1px_0_rgba(255,255,255,0.95)]",
          "hover:text-foreground",
          "active:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_4px_rgba(255,255,255,0.30),inset_0_2px_4px_rgba(0,0,0,0.08)]",
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
        round: "rounded-full w-12 h-12 text-base",
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
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(glassButtonVariants({ variant, size }), className)}
        data-variant={variant ?? "default"}
        {...props}
      >
        {/* Iridescent holographic sheen overlay — only on primary */}
        {variant === "primary" && (
          <span
            className="pointer-events-none absolute inset-0 rounded-[inherit] z-[1] opacity-60 hover:opacity-80 transition-opacity duration-200"
            style={{
              background: "conic-gradient(from 220deg at 50% 50%, rgba(157,208,255,0.12), rgba(196,181,253,0.10) 25%, rgba(255,182,193,0.08) 50%, rgba(173,216,230,0.10) 75%, rgba(157,208,255,0.12))",
              mixBlendMode: "normal",
            }}
          />
        )}
        {/* Content sits above the sheen */}
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
