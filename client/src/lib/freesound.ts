/**
 * Freesound API helper — client-side.
 * All calls proxy through /api/freesound/* to keep the API key server-side.
 */
import { apiRequest } from "./queryClient";

export interface FreesoundResult {
  id: number;
  name: string;
  duration: number;
  username: string;
  license: string;
  previews: {
    "preview-lq-mp3"?: string;
    "preview-hq-mp3"?: string;
    "preview-lq-ogg"?: string;
    "preview-hq-ogg"?: string;
  };
}

export interface FreesoundSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FreesoundResult[];
}

export async function searchFreesound(
  query: string,
  page = 1,
): Promise<FreesoundSearchResponse> {
  const params = new URLSearchParams({ q: query, page: String(page) });
  const res = await apiRequest("GET", `/api/freesound/search?${params}`);
  return res.json();
}

/** Returns a preview URL — either a direct CDN URL or proxied */
export function getPreviewUrl(sound: FreesoundResult): string {
  return (
    sound.previews["preview-lq-mp3"] ||
    sound.previews["preview-hq-mp3"] ||
    sound.previews["preview-lq-ogg"] ||
    sound.previews["preview-hq-ogg"] ||
    ""
  );
}
