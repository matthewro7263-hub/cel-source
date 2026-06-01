// Format a deadline string (YYYY-MM-DD) → relative phrase + tone.
export function formatDeadline(deadline?: string | null): { text: string; tone: "overdue-amber" | "overdue-orange" | "red" | "amber" | "green" | "muted"; daysOverdue?: number } {
  if (!deadline) return { text: "No deadline", tone: "muted" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Robust timezone-safe local date construction
  const parts = deadline.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return { text: "Invalid date", tone: "muted" };
  }
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);

  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) {
    const daysOverdue = Math.abs(diff);
    if (daysOverdue >= 1 && daysOverdue <= 7) {
      return { text: `${daysOverdue}d overdue`, tone: "overdue-amber", daysOverdue };
    }
    if (daysOverdue >= 8 && daysOverdue <= 13) {
      return { text: `${daysOverdue}d overdue`, tone: "overdue-orange", daysOverdue };
    }
    return { text: `${daysOverdue}d overdue`, tone: "red", daysOverdue };
  }
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
  return name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}

export function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}
export function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}
