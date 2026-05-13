export type VisemeName = "AI" | "E" | "O" | "MBP" | "FV" | "L" | "WQ" | "rest";

export interface VisemeKeyframe {
  viseme: VisemeName;
  startMs: number;
  endMs: number;
}

export interface LipsyncOptions {
  msPerPhoneme?: number;
  wordGapMs?: number;
  punctuationGapMs?: number;
}

const DEFAULT_OPTIONS: Required<LipsyncOptions> = {
  msPerPhoneme: 90,
  wordGapMs: 70,
  punctuationGapMs: 120,
};

export const MOUTH_COLORS: Record<VisemeName, string> = {
  AI: "#FF9999",
  E: "#FFCC99",
  O: "#FFFF99",
  MBP: "#99FF99",
  FV: "#99FFFF",
  L: "#9999FF",
  WQ: "#CC99FF",
  rest: "#CCCCCC",
};

export function phonemeToViseme(char: string): VisemeName | null {
  const c = char.toUpperCase();
  if (!/[A-Z0-9]/.test(c)) return null;
  if (c === "A" || c === "I" || c === "Y") return "AI";
  if (c === "E") return "E";
  if (c === "O" || c === "U") return "O";
  if ("MBP".includes(c)) return "MBP";
  if ("FV".includes(c)) return "FV";
  if (c === "L") return "L";
  if ("WQ".includes(c)) return "WQ";
  return "rest";
}

export function mergeAdjacentVisemes(timeline: VisemeKeyframe[]): VisemeKeyframe[] {
  const merged: VisemeKeyframe[] = [];
  for (const item of timeline) {
    const previous = merged[merged.length - 1];
    if (previous && previous.viseme === item.viseme && previous.endMs === item.startMs) {
      previous.endMs = item.endMs;
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}

export function generateLipsyncTimeline(transcript: string, options: LipsyncOptions = {}): VisemeKeyframe[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const timeline: VisemeKeyframe[] = [];
  let currentTimeMs = 0;
  const words = transcript.split(/\s+/).filter(Boolean);

  words.forEach((word, wordIndex) => {
    for (const char of word) {
      const viseme = phonemeToViseme(char);
      if (!viseme) continue;
      timeline.push({
        viseme,
        startMs: currentTimeMs,
        endMs: currentTimeMs + opts.msPerPhoneme,
      });
      currentTimeMs += opts.msPerPhoneme;
    }

    const hasTerminalPunctuation = /[,.!?;:]$/.test(word);
    const gap = wordIndex === words.length - 1
      ? hasTerminalPunctuation ? opts.punctuationGapMs : 0
      : opts.wordGapMs;
    if (gap > 0) {
      timeline.push({ viseme: "rest", startMs: currentTimeMs, endMs: currentTimeMs + gap });
      currentTimeMs += gap;
    }
  });

  return timeline;
}

export function buildMohoSwitchDat(timeline: VisemeKeyframe[], fps = 24): string {
  const compact = mergeAdjacentVisemes(timeline);
  return compact
    .map((item) => `${Math.round((item.startMs / 1000) * fps)} ${item.viseme}`)
    .join("\n") + (compact.length ? "\n" : "");
}

export function buildBlenderVisemeJson(timeline: VisemeKeyframe[]): string {
  return JSON.stringify({
    schema: "cel.lipsync.visemes.v1",
    generatedAt: new Date().toISOString(),
    keyframes: mergeAdjacentVisemes(timeline),
  }, null, 2);
}
