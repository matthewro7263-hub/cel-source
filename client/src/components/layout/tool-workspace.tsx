import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ToolWorkspaceProps {
  backAction?: ReactNode;
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  main: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  className?: string;
  mainClassName?: string;
  asideClassName?: string;
}

export function ToolWorkspace({
  backAction,
  title,
  icon,
  badge,
  meta,
  actions,
  main,
  aside,
  footer,
  className,
  mainClassName,
  asideClassName,
}: ToolWorkspaceProps) {
  return (
    <div className={cn("px-5 py-7 sm:px-6 lg:px-10 lg:py-10", className)}>
      <div className="mx-auto max-w-[1560px] space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            {backAction}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {icon}
                <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
                {badge}
              </div>
              {meta && <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{meta}</div>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>

        <div className={cn("grid gap-5", aside ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1")}>
          <div className={cn("min-w-0 space-y-5", mainClassName)}>
            {main}
            {footer}
          </div>
          {aside && <aside className={cn("space-y-4", asideClassName)}>{aside}</aside>}
        </div>
      </div>
    </div>
  );
}

interface ToolSurfaceProps {
  children: ReactNode;
  className?: string;
}

export function ToolSurface({ children, className }: ToolSurfaceProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/70 bg-background/88 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-[14px]",
        className,
      )}
    >
      {children}
    </section>
  );
}
