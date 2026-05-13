import { CelWordmark } from "@/components/CelLogo";
import type { Project } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function CliShareHeader({ project }: { project: Project }) {
  // Use a query to get approvals to compute milestone progress
  const { data: approvals = [] } = useQuery({
    queryKey: ["/api/projects", project.id, "cli_approvals"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${project.id}/cli_approvals`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const phases = ["storyboard", "animatic", "animation", "polish"];
  const approvedPhases = new Set(approvals.map((a: any) => a.phase));

  // Determine styles from project brand settings
  const brandColor = (project as any).cli_brandColor || "#9DD0FF";
  const brandLogo = (project as any).cli_brandLogo;
  const brandWelcome = (project as any).cli_brandWelcome;

  return (
    <div className="flex flex-col">
      <header className="border-b border-border bg-sidebar" style={{ borderBottomColor: `${brandColor}40` }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {brandLogo ? (
              <img src={brandLogo} alt="Brand Logo" className="h-8 object-contain" />
            ) : (
              <CelWordmark />
            )}
            {brandWelcome && (
              <div className="text-sm font-medium" style={{ color: brandColor }}>
                {brandWelcome}
              </div>
            )}
          </div>
          
          {/* Milestone Progress Widget */}
          <div className="flex items-center gap-3">
            {phases.map((phase, i) => {
              const isApproved = approvedPhases.has(phase);
              const isAnimationPolish = phase === "animation" || phase === "polish"; // Assuming these are marked differently or manually later
              // Check if project status reflects completion (simplified logic)
              const completed = isApproved || (isAnimationPolish && project.status === "completed");

              return (
                <div key={phase} className="flex items-center gap-1">
                  {completed ? (
                    <CheckCircle2 size={16} style={{ color: brandColor }} />
                  ) : (
                    <Circle size={16} className="text-muted-foreground/40" />
                  )}
                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${completed ? "" : "text-muted-foreground/60"}`}
                        style={completed ? { color: brandColor } : {}}>
                    {phase}
                  </span>
                  {i < phases.length - 1 && (
                    <div className="w-4 h-px bg-border mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>
    </div>
  );
}
