/**
 * Animatic editor nav item — exported so other subagents can import if needed.
 * Used in the project workspace tabs (AnimaticsTab section).
 */
import { Film } from "lucide-react";
import { useLocation } from "wouter";

interface AnimaticNavItemProps {
  projectId: number;
  animaticId?: number;
  label?: string;
}

export function AnimaticEditorNavItem({ projectId, animaticId, label }: AnimaticNavItemProps) {
  const [, navigate] = useLocation();
  if (!animaticId) return null;
  return (
    <button
      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
      onClick={() => navigate(`/projects/${projectId}/animatic/${animaticId}`)}
    >
      <Film size={12} />
      {label || "Open in editor"}
    </button>
  );
}
