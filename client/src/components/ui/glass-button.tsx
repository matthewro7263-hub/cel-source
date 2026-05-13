import { ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * GlassButton — three variants matching the reference images:
 *
 * 1. primary   — Solid flat-blue surface + crisp white halo ring (Apple-style flat glass)
 *                Depth comes from halo, inset highlight, drop shadow, and specular glint span.
 *                NO gradient on the button surface itself.
 * 2. ghost     — Solid white frosted glass, lavender glow on hover
 * 3. toolbar   — Inline icon button for glass pill toolbars
 *
 * Sizes:
 *   pill  — rounded-full, padded (primary CTA)
 *   round — rounded-full aspect-square w-12 (icon-only FAB)
 *   sm    — compact rounded-xl (secondary actions)
 *   md    — default
 *
 * NO translate/translateY on hover — only light/shadow changes to prevent
 * the "dodge" feel. Active states use scale(0.97) only.
 */
const glassButtonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2",
    "font-semibold select-none cursor-pointer",
    // NO translateY or translate3d — these cause the "dodge" effect
    "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
    "active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40",
    "overflow-hidden",
  ],
  {
    variants: {
      variant: {
        /**
         * Primary — solid flat-blue surface, Apple-style flat glass.
         * Surface color: #9DD0FF (soft muted blue — not neon, not gradient).
         * All depth comes from:
         *   • white halo ring (outer box-shadow 1.5px)
         *   • outer glow rings (ambient blue)
         *   • inset 0 1px highlight at top (rim light)
         *   • inset 0 -1px dark at bottom (ground shadow)
         *   • drop shadow for elevation
         *   • specular glint <span> overlay (radial white near top)
         */
        primary: [
          "text-white tracking-wide",
          // Solid flat surface — NO gradient
          "bg-[#9DD0FF]",
          // White halo ring + glow rings + inset rim highlights + drop shadow
          "shadow-[0_0_0_1.5px_rgba(255,255,255,0.95),0_0_0_3px_rgba(157,208,255,0.30),0_6px_16px_rgba(80,150,230,0.22),0_12px_32px_-8px_rgba(80,150,230,0.18),inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-1px_0_rgba(40,100,180,0.12)]",
          // Hover: surface lightens slightly, glow expands — NO translate, NO gradient
          "hover:bg-[#AED9FF]",
          "hover:shadow-[0_0_0_1.5px_rgba(255,255,255,1),0_0_0_4px_rgba(157,208,255,0.40),0_8px_24px_rgba(80,150,230,0.30),0_16px_40px_-8px_rgba(80,150,230,0.22),inset_0_1px_0_rgba(255,255,255,0.80),inset_0_-1px_0_rgba(40,100,180,0.12)]",
          // Active: surface darkens slightly, squish, pressed-in inset shadow
          "active:bg-[#87C3FF]",
          "active:shadow-[0_0_0_1.5px_rgba(255,255,255,0.88),0_0_0_2px_rgba(157,208,255,0.22),0_2px_6px_rgba(80,150,230,0.18),inset_0_2px_6px_rgba(40,100,180,0.14)]",
        ],
        /**
         * Ghost — white frosted pill with lavender glow on hover
         */
        ghost: [
          "text-muted-foreground",
          "bg-white/92 dark:bg-white/10",
          "backdrop-blur-xl",
          "border border-white/90 dark:border-white/15",
          "shadow-[0_2px_8px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(0,0,0,0.04)]",
          // Hover: lavender glow + icon color change — NO translate
          "hover:bg-white/97 dark:hover:bg-white/15",
          "hover:text-primary",
          "hover:shadow-[0_0_32px_rgba(190,160,255,0.55),0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(0,0,0,0.04)]",
          "active:shadow-[0_0_16px_rgba(190,160,255,0.3),inset_0_2px_4px_rgba(0,0,0,0.06)]",
        ],
        /**
         * Toolbar icon button — borderless, used inside GlassToolbar
         * No movement on hover
         */
        toolbar: [
          "text-muted-foreground",
          "hover:text-foreground",
          "hover:bg-white/50 dark:hover:bg-white/10",
          "rounded-lg",
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
        {...props}
      >
        {/* Inner specular glint — top-center highlight for sphere illusion */}
        {variant === "primary" && (
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-[45%] rounded-[inherit]"
            style={{
              background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)",
            }}
          />
        )}
        {children}
      </button>
    );
  }
);
GlassButton.displayName = "GlassButton";

/**
 * GlassToolbar — frosted long pill container for icon buttons (image-4.jpg)
 * Internal hairline dividers via [&>*+*]:border-l
 * Usage: <GlassToolbar><GlassButton variant="toolbar">…</GlassButton></GlassToolbar>
 */
export function GlassToolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0 px-1.5 py-1 rounded-full",
        "bg-white/75 dark:bg-white/8 backdrop-blur-2xl",
        "border border-white/80 dark:border-white/12",
        "shadow-[0_2px_12px_rgba(0,0,0,0.07),inset_0_1px_0_rgba(255,255,255,0.9)]",
        // Hairline dividers between children
        "[&>*+*]:border-l [&>*+*]:border-black/[0.06] dark:[&>*+*]:border-white/10",
        className
      )}
    >
      {children}
    </div>
  );
}

export default GlassButton;
