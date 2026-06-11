import { apiRequest } from "./queryClient";

type PanelLike = { imageData?: string | null; r2Key?: string | null };

const presignCache = new Map<string, { url: string; expiresAt: number }>();

function cacheKey(scope: string, r2Key: string) {
  return `${scope}:${r2Key}`;
}

async function fetchPresignedUrl(path: string, scope: string, r2Key: string): Promise<string> {
  const key = cacheKey(scope, r2Key);
  const cached = presignCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.url;

  const res = await apiRequest("GET", `${path}?key=${encodeURIComponent(r2Key)}`);
  if (!res.ok) throw new Error(`${res.status}: failed to resolve media`);
  const data = (await res.json()) as { url: string; expiresIn?: number };
  const ttlMs = (data.expiresIn ?? 300) * 1000 - 30_000;
  presignCache.set(key, { url: data.url, expiresAt: Date.now() + Math.max(ttlMs, 60_000) });
  return data.url;
}

export function projectMediaPath(projectId: number) {
  return `/api/projects/${projectId}/media`;
}

export function shareMediaPath(shareToken: string) {
  return `/api/share/${shareToken}/media`;
}

/** Immediate src when available (imageData only). Empty string means async resolve needed. */
export function panelImageSrcImmediate(panel: PanelLike): string {
  if (panel.imageData) return panel.imageData;
  return "";
}

export async function resolvePanelImageUrl(
  panel: PanelLike,
  opts: { projectId?: number; shareToken?: string },
): Promise<string> {
  if (panel.imageData) return panel.imageData;
  if (!panel.r2Key) return "";
  if (opts.projectId) {
    return fetchPresignedUrl(projectMediaPath(opts.projectId), `p${opts.projectId}`, panel.r2Key);
  }
  if (opts.shareToken) {
    return fetchPresignedUrl(shareMediaPath(opts.shareToken), `s${opts.shareToken}`, panel.r2Key);
  }
  return "";
}

export async function resolveAssetDownloadUrl(
  assetId: number,
): Promise<{ url?: string; fileData?: string | null; filename: string; mimeType: string }> {
  const res = await apiRequest("GET", `/api/assets/${assetId}/download`);
  if (!res.ok) throw new Error(`${res.status}: download failed`);
  return res.json();
}