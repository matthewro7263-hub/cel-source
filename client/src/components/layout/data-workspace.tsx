import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DataWorkspaceProps {
  title: string;
  icon?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DataWorkspace({
  title,
  icon,
  description,
  actions,
  summary,
  filters,
  children,
  className,
  contentClassName,
}: DataWorkspaceProps) {
  return (
    <div className={cn("px-5 py-7 sm:px-6 lg:px-10 lg:py-10", className)}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              {icon}
              <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
            </div>
            {description && <div className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>

        {summary && (
          <section className="rounded-2xl border border-border/70 bg-background/84 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)] backdrop-blur-[12px]">
            {summary}
          </section>
        )}

        {filters && (
          <section className="rounded-2xl border border-border/70 bg-background/84 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)] backdrop-blur-[12px]">
            {filters}
          </section>
        )}

        <div className={cn("space-y-6", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}

interface DataSurfaceProps {
  children: ReactNode;
  className?: string;
}

export function DataSurface({ children, className }: DataSurfaceProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/70 bg-background/88 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur-[12px]",
        className,
      )}
    >
      {children}
    </section>
  );
}
