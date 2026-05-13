/**
 * Client-side types for the animatic editor.
 * Extends the server types with assembled track+clip structure.
 */

export interface AnimaticClipData {
  id: number;
  trackId: number;
  startMs: number;
  durationMs: number;
  sourceKind: string; // panel_ref | asset_ref | audio_data
  sourceId: number | null;
  audioDataUrl: string | null;
  label: string;
  fadeInMs: number;
  fadeOutMs: number;
  volume: string;
  // Resolved at runtime by the editor
  resolvedImageUrl?: string;
  resolvedAudioUrl?: string;
}

export interface AnimaticTrackData {
  id: number;
  animaticProjectId: number;
  kind: string; // panel | voice | sfx | music
  name: string;
  orderIdx: number;
  muted: boolean;
  volume: string;
  clips: AnimaticClipData[];
}

export interface AnimaticProjectFull {
  id: number;
  projectId: number;
  title: string;
  fps: number;
  totalDurationMs: number;
  createdAt: string;
  updatedAt: string;
  tracks: AnimaticTrackData[];
}

/** Color palette for track kinds */
export const TRACK_COLORS: Record<string, { bg: string; border: string; text: string; clipBg: string }> = {
  panel: {
    bg: "rgba(110, 79, 232, 0.15)",
    border: "rgba(110, 79, 232, 0.4)",
    text: "#c4b5fd",
    clipBg: "rgba(110, 79, 232, 0.7)",
  },
  voice: {
    bg: "rgba(59, 130, 246, 0.15)",
    border: "rgba(59, 130, 246, 0.4)",
    text: "#93c5fd",
    clipBg: "rgba(59, 130, 246, 0.7)",
  },
  sfx: {
    bg: "rgba(16, 185, 129, 0.15)",
    border: "rgba(16, 185, 129, 0.4)",
    text: "#6ee7b7",
    clipBg: "rgba(16, 185, 129, 0.7)",
  },
  music: {
    bg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.4)",
    text: "#fcd34d",
    clipBg: "rgba(245, 158, 11, 0.7)",
  },
};

export function getTrackColor(kind: string) {
  return TRACK_COLORS[kind] || TRACK_COLORS.sfx;
}

/** Format milliseconds as MM:SS.cc */
export function formatTime(ms: number): string {
  const totalSecs = ms / 1000;
  const mm = Math.floor(totalSecs / 60).toString().padStart(2, "0");
  const ss = Math.floor(totalSecs % 60).toString().padStart(2, "0");
  const cc = Math.floor((totalSecs % 1) * 100).toString().padStart(2, "0");
  return `${mm}:${ss}.${cc}`;
}
