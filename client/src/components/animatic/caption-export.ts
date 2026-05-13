export interface CaptionExportCue {
  startMs: number;
  endMs: number;
  text: string;
}

export function parseCaptionTimeMs(value: string): number | null {
  const match = value.trim().match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!match) return null;
  const [, hh, mm, ss, rawMs] = match;
  const hours = Number(hh);
  const minutes = Number(mm);
  const seconds = Number(ss);
  const millis = Number(rawMs.padEnd(3, "0"));
  if ([hours, minutes, seconds, millis].some((part) => Number.isNaN(part))) return null;
  if (minutes > 59 || seconds > 59) return null;
  return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + millis;
}

function orderedCues(cues: CaptionExportCue[]): CaptionExportCue[] {
  return [...cues]
    .filter((cue) => cue.text.trim() && cue.endMs > cue.startMs)
    .sort((a, b) => a.startMs - b.startMs);
}

function formatCaptionTime(ms: number, separator: "." | ","): string {
  const safeMs = Math.max(0, Math.round(ms));
  const h = Math.floor(safeMs / 3_600_000).toString().padStart(2, "0");
  const m = Math.floor((safeMs % 3_600_000) / 60_000).toString().padStart(2, "0");
  const s = Math.floor((safeMs % 60_000) / 1_000).toString().padStart(2, "0");
  const mm = (safeMs % 1_000).toString().padStart(3, "0");
  return `${h}:${m}:${s}${separator}${mm}`;
}

export function formatVttTime(ms: number): string {
  return formatCaptionTime(ms, ".");
}

export function formatSrtTime(ms: number): string {
  return formatCaptionTime(ms, ",");
}

export function buildVtt(cues: CaptionExportCue[]): string {
  const lines = ["WEBVTT", ""];
  for (const cue of orderedCues(cues)) {
    lines.push(`${formatVttTime(cue.startMs)} --> ${formatVttTime(cue.endMs)}`);
    lines.push(...cue.text.trim().split(/\r?\n/));
    lines.push("");
  }
  return lines.join("\n");
}

export function buildSrt(cues: CaptionExportCue[]): string {
  const lines: string[] = [];
  orderedCues(cues).forEach((cue, index) => {
    lines.push(String(index + 1));
    lines.push(`${formatSrtTime(cue.startMs)} --> ${formatSrtTime(cue.endMs)}`);
    lines.push(...cue.text.trim().split(/\r?\n/));
    lines.push("");
  });
  return lines.join("\n");
}

export function downloadCaptionFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
