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
  const key = status.toLowerCase();
  if ((STATUS_ORDER as readonly string[]).includes(key)) return `status-${key}`;
  return "status-default";
}

/** Map workflow status → glass chip utility class (Dashboard, queue cards). */
export function chipClass(status: string): string {
  switch (status.toLowerCase()) {
    case "storyboard":
    case "animatic":
      return "chip-lilac";
    case "review":
      return "chip-rose";
    case "done":
    case "final":
      return "chip-sage";
    case "script":
      return "chip-sky";
    default:
      return "chip";
  }
}

/** Tailwind text-color class for deadline tone badges. */
export function deadlineToneClass(tone: ReturnType<typeof formatDeadline>["tone"]): string {
  switch (tone) {
    case "red":
    case "overdue-orange":
      return "text-red-500";
    case "amber":
    case "overdue-amber":
      return "text-amber-500";
    case "green":
      return "text-emerald-500";
    default:
      return "text-muted-foreground";
  }
}

/** Relative time phrase — "just now", "5m ago", "3d ago". */
export function formatRelative(dateInput: string | Date | number): string {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "unknown";

  const now = Date.now();
  const seconds = Math.floor((now - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 90) return "1m ago";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  return formatAbsolute(date);
}

/** Locale-aware absolute timestamp for tooltips / detail views. */
export function formatAbsolute(dateInput: string | Date | number): string {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function initials(name: string) {
  if (!name?.trim()) return "";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}
export function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}
