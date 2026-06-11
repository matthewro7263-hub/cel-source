import { useEffect, useState } from "react";
import { panelImageSrcImmediate, resolvePanelImageUrl } from "@/lib/panelMedia";

type PanelLike = { imageData?: string | null; r2Key?: string | null };

interface PanelImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  panel: PanelLike;
  projectId?: number;
  shareToken?: string;
  fallback?: React.ReactNode;
}

export function PanelImage({
  panel,
  projectId,
  shareToken,
  fallback = null,
  alt = "",
  ...imgProps
}: PanelImageProps) {
  const immediate = panelImageSrcImmediate(panel);
  const [src, setSrc] = useState(immediate);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    const direct = panelImageSrcImmediate(panel);
    if (direct) {
      setSrc(direct);
      return;
    }
    if (!panel.r2Key || (!projectId && !shareToken)) {
      setSrc("");
      return;
    }
    let cancelled = false;
    resolvePanelImageUrl(panel, { projectId, shareToken })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) { setSrc(""); setFailed(true); } });
    return () => { cancelled = true; };
  }, [panel.imageData, panel.r2Key, projectId, shareToken]);

  if (!src || failed) return <>{fallback}</>;
  return <img src={src} alt={alt} {...imgProps} />;
}