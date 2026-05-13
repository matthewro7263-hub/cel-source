// Format a deadline string (YYYY-MM-DD) → relative phrase + tone.
export function formatDeadline(deadline?: string | null): { text: string; tone: "red" | "amber" | "green" | "muted" } {
  if (!deadline) return { text: "No deadline", tone: "muted" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, tone: "red" };
  if (diff === 0) return { text: "Due today", tone: "red" };
  if (diff <= 3) return { text: `in ${diff}d`, tone: "amber" };
  if (diff <= 14) return { text: `in ${diff}d`, tone: "green" };
  return { text: `in ${diff}d`, tone: "muted" };
}

export const STATUS_LABELS: Record<string, string> = {
  script: "Script",
  storyboard: "Storyboard",
  animatic: "Animatic",
  final: "Final",
  done: "Done",
};

export const STATUS_ORDER = ["script", "storyboard", "animatic", "final", "done"] as const;

export function statusClass(status: string) {
  return `status-${status}`;
}

export function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}

export function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}
export function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}
