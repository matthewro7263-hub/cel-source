import { useState } from "react";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AmberOwnerBannerProps {
  projectId: number;
  /** Whether the project already has the watermark removed. If true, banner is hidden. */
  watermarkRemoved: boolean;
}

/**
 * CEL-MON-002: AmberOwnerBanner
 *
 * Shown only on the project owner's dashboard/workspace when shareEnabled is true
 * and watermarkRemoved is false. Nudges them to pay $9 once to remove the
 * "PREVIEW" watermark from all shared links for this project.
 *
 * Clicking the CTA hits POST /api/projects/:id/watermark/checkout which
 * returns a Stripe Checkout URL, then redirects.
 */
export function AmberOwnerBanner({ projectId, watermarkRemoved }: AmberOwnerBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (watermarkRemoved || dismissed) return null;

  async function handleUpgrade() {
    setLoading(true);
    try {
      const token = localStorage.getItem("cel_token") ?? "";
      const res = await fetch(`/api/projects/${projectId}/watermark/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.message ?? "Failed to start checkout. Please try again.");
        setLoading(false);
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      alert("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-amber-200">
        <Sparkles size={15} className="shrink-0 text-amber-400" />
        <span>
          Your shared links show a{" "}
          <span className="font-semibold text-amber-300">PREVIEW watermark</span>.
          Remove it once for{" "}
          <span className="font-semibold text-amber-300">$9</span>.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          className="h-7 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-3 text-xs"
          onClick={handleUpgrade}
          disabled={loading}
        >
          {loading ? "Redirecting…" : "Remove Watermark"}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400/60 hover:text-amber-400 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
