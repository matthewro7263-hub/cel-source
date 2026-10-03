import type { ReactNode } from "react";
import { CelLogo } from "@/components/CelLogo";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";

/** Shared chrome for the signed-out account screens (forgot / reset password). */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background relative overflow-hidden">
      <div className="blob blob-lavender" />
      <div className="blob blob-peach" />
      <div className="blob blob-sky" />
      <div className="dot-grid" />
      <div className="w-full max-w-sm relative z-10">
        <div className="flex items-center justify-center mb-8 text-primary">
          <CelLogo size={48} />
        </div>
        <h1 className="font-display text-2xl font-bold text-center mb-1.5 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground text-center mb-8">{subtitle}</p>}
        <LiquidGlassCard refract depth="strong" displacement={12} borderRadius={16} className="rounded-2xl p-7 space-y-5">
          {children}
        </LiquidGlassCard>
      </div>
    </div>
  );
}
