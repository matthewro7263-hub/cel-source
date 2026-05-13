export interface ComparePanel {
  id: number;
  orderIdx: number;
  imageData: string;
  caption?: string;
  dialogue?: string;
}

export interface CompareStoryboard {
  id: number;
  title: string;
  panels?: ComparePanel[];
}

export interface CompareAnimatic {
  id: number;
  title: string;
  videoData: string;
  notes?: string;
  createdAt?: string;
}

export interface CompareMediaItem {
  id: number;
  key: string;
  kind: "panel" | "animatic";
  label: string;
  src: string;
  caption: string;
}

export function flattenComparableMedia(
  storyboards: CompareStoryboard[] = [],
  animatics: CompareAnimatic[] = [],
): CompareMediaItem[] {
  const panels = storyboards.flatMap((storyboard) => {
    return [...(storyboard.panels || [])]
      .sort((a, b) => a.orderIdx - b.orderIdx)
      .map((panel, index) => ({
        id: panel.id,
        key: `panel-${panel.id}`,
        kind: "panel" as const,
        label: `${storyboard.title} - Panel ${index + 1}`,
        src: panel.imageData,
        caption: [panel.dialogue, panel.caption].filter(Boolean).join(" - "),
      }));
  });

  const cuts = animatics.map((animatic) => ({
    id: animatic.id,
    key: `animatic-${animatic.id}`,
    kind: "animatic" as const,
    label: animatic.title,
    src: animatic.videoData,
    caption: animatic.notes || animatic.createdAt || "",
  }));

  return [...panels, ...cuts];
}

export function isVideoSource(src: string): boolean {
  return src.startsWith("data:video/") || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src);
}
