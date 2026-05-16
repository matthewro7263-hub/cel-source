import { useQuery } from "@tanstack/react-query";

interface CliWatermarkOverlayProps {
  projectId: number;
  projectName: string;
  token?: string;
  /** When true the overlay is suppressed even without querying (owner view). */
  ownerView?: boolean;
}

export function CliWatermarkOverlay({
  projectId,
  projectName,
  token,
  ownerView = false,
}: CliWatermarkOverlayProps) {
  const { data: projectMeta } = useQuery({
    queryKey: token ? ["/api/share", token, "meta"] : ["/api/projects", projectId],
    queryFn: async () => {
      const endpoint = token
        ? `/api/share/${token}/meta`
        : `/api/projects/${projectId}`;
      const res = await fetch(endpoint);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: approvals = [] } = useQuery({
    queryKey: token
      ? ["/api/share", token, "cli_approvals"]
      : ["/api/projects", projectId, "cli_approvals"],
    queryFn: async () => {
      const endpoint = token
        ? `/api/share/${token}/cli_approvals`
        : `/api/projects/${projectId}/cli_approvals`;
      const res = await fetch(endpoint);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Watermark is hidden when:
  //  1. The owner is viewing their own project in the workspace (ownerView prop)
  //  2. The project has been paid to remove the watermark (watermarkRemoved flag)
  //  3. The project is final-approved or completed
  const watermarkRemoved = !!(projectMeta as any)?.watermarkRemoved;
  const isFinalApproved =
    approvals.some((a: any) => a.phase === "final") ||
    projectMeta?.status === "completed";

  if (ownerView || watermarkRemoved || isFinalApproved) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-50 flex items-center justify-center opacity-30 mix-blend-overlay"
    >
      <div
        className="transform -rotate-45 text-4xl sm:text-6xl font-black text-white whitespace-nowrap tracking-widest uppercase"
        style={{ textShadow: "2px 2px 8px rgba(0,0,0,0.8)" }}
      >
        PREVIEW · {projectMeta?.title || projectName}
      </div>
    </div>
  );
}
