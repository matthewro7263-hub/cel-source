import { apiRequest } from "./queryClient";

/**
 * Open a review-room WebSocket without putting the long-lived session token in
 * the URL: exchange it for a short-lived, single-use ticket first.
 * Resolves to null when the ticket can't be obtained (e.g. not signed in).
 */
export async function openReviewRoomSocket(projectId: number | string): Promise<WebSocket | null> {
  const res = await apiRequest("POST", `/api/projects/${projectId}/review-room/ticket`);
  if (!res.ok) return null;
  const { ticket } = (await res.json()) as { ticket: string };
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return new WebSocket(
    `${protocol}://${window.location.host}/api/projects/${projectId}/review-room?ticket=${encodeURIComponent(ticket)}`,
  );
}
