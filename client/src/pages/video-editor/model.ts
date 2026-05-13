export type VideoEditorClipKind = "panel" | "animatic";

export interface VideoEditorClip {
  id: string;
  kind: VideoEditorClipKind;
  src: string;
  label: string;
  durationMs: number;
  sourceDurationMs?: number;
  trimStartMs?: number;
}

export interface ClipSpan {
  clip: VideoEditorClip;
  index: number;
  startMs: number;
  endMs: number;
  localMs: number;
}

export const DEFAULT_PANEL_MS = 1500;
export const DEFAULT_ANIMATIC_MS = 4000;
export const MIN_CLIP_MS = 100;
export const MAX_CLIP_MS = 120_000;
export const DEFAULT_PX_PER_SECOND = 72;

export function sanitizeDurationMs(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_PANEL_MS;
  return Math.min(MAX_CLIP_MS, Math.max(MIN_CLIP_MS, Math.round(ms)));
}

export function totalDurationMs(clips: VideoEditorClip[]): number {
  return clips.reduce((sum, clip) => sum + sanitizeDurationMs(clip.durationMs), 0);
}

export function formatTimestamp(ms: number): string {
  const clamped = Math.max(0, ms);
  const seconds = Math.floor(clamped / 1000);
  const centiseconds = Math.floor((clamped % 1000) / 10);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

export function getClipSpans(clips: VideoEditorClip[]): ClipSpan[] {
  let acc = 0;
  return clips.map((clip, index) => {
    const durationMs = sanitizeDurationMs(clip.durationMs);
    const span = {
      clip,
      index,
      startMs: acc,
      endMs: acc + durationMs,
      localMs: 0,
    };
    acc += durationMs;
    return span;
  });
}

export function findClipAtTime(clips: VideoEditorClip[], playheadMs: number): ClipSpan | null {
  if (clips.length === 0) return null;
  const clamped = Math.max(0, Math.min(playheadMs, totalDurationMs(clips)));
  const spans = getClipSpans(clips);
  const span =
    spans.find((candidate) => clamped >= candidate.startMs && clamped < candidate.endMs) ??
    spans[spans.length - 1] ??
    null;
  return span ? { ...span, localMs: Math.max(0, clamped - span.startMs) } : null;
}

export function moveClipById(
  clips: VideoEditorClip[],
  clipId: string,
  direction: -1 | 1,
): VideoEditorClip[] {
  const index = clips.findIndex((clip) => clip.id === clipId);
  if (index < 0) return clips;
  const target = index + direction;
  if (target < 0 || target >= clips.length) return clips;
  const next = [...clips];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function duplicateClip(
  clips: VideoEditorClip[],
  clipId: string,
  createId: () => string,
): VideoEditorClip[] {
  const index = clips.findIndex((clip) => clip.id === clipId);
  if (index < 0) return clips;
  const original = clips[index];
  const copy: VideoEditorClip = {
    ...original,
    id: createId(),
    label: `${original.label} copy`,
  };
  return [...clips.slice(0, index + 1), copy, ...clips.slice(index + 1)];
}

export function splitClipAtPlayhead(
  clips: VideoEditorClip[],
  clipId: string,
  playheadMs: number,
  createId: (suffix: "left" | "right") => string,
): { clips: VideoEditorClip[]; selectedClipId: string | null } {
  const span = findClipAtTime(clips, playheadMs);
  if (!span || span.clip.id !== clipId) return { clips, selectedClipId: clipId };

  const leftMs = Math.round(playheadMs - span.startMs);
  const rightMs = Math.round(span.endMs - playheadMs);
  if (leftMs < MIN_CLIP_MS || rightMs < MIN_CLIP_MS) {
    return { clips, selectedClipId: clipId };
  }

  const trimStartMs = span.clip.trimStartMs ?? 0;
  const left: VideoEditorClip = {
    ...span.clip,
    id: createId("left"),
    label: `${span.clip.label} A`,
    durationMs: sanitizeDurationMs(leftMs),
  };
  const right: VideoEditorClip = {
    ...span.clip,
    id: createId("right"),
    label: `${span.clip.label} B`,
    durationMs: sanitizeDurationMs(rightMs),
    trimStartMs: span.clip.kind === "animatic" ? trimStartMs + leftMs : trimStartMs,
  };

  return {
    clips: [
      ...clips.slice(0, span.index),
      left,
      right,
      ...clips.slice(span.index + 1),
    ],
    selectedClipId: right.id,
  };
}
