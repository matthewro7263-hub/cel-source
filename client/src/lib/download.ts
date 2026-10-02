import { apiRequest } from "./queryClient";

/** Download an authenticated API response as a file (plain <a href> can't send the Bearer token). */
export async function downloadAuthed(url: string, fallbackFilename: string): Promise<void> {
  const res = await apiRequest("GET", url);
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).message ?? detail; } catch { /* non-JSON error body */ }
    throw new Error(detail || `Download failed (${res.status})`);
  }
  let filename = fallbackFilename;
  const match = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "");
  if (match?.[1]) filename = match[1];
  const blobUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
