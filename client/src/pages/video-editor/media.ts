import {
  findClipAtTime,
  formatTimestamp,
  totalDurationMs,
  type VideoEditorClip,
} from "./model";

type CanvasSource = CanvasImageSource & { width?: number; height?: number };

export interface ExportVideoEditOptions {
  clips: VideoEditorClip[];
  fps: number;
  width: number;
  height: number;
  onProgress?: (progress: number, status: string) => void;
}

export function isCanvasDrawableVideoSource(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("data:video/") || src.startsWith("blob:")) return true;
  try {
    const url = new URL(src, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function canProbeVideoMetadata(src: string): boolean {
  if (!src) return false;
  if (isCanvasDrawableVideoSource(src)) return true;
  return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(src);
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

export function probeVideoDurationMs(src: string): Promise<number | null> {
  if (!canProbeVideoMetadata(src)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    const done = (value: number | null) => {
      if (settled) return;
      settled = true;
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };
    const timeout = window.setTimeout(() => done(null), 5000);
    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      done(Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null);
    };
    video.onerror = () => {
      window.clearTimeout(timeout);
      done(null);
    };
    video.src = src;
  });
}

export function drawContain(
  ctx: CanvasRenderingContext2D,
  source: CanvasSource,
  canvasWidth: number,
  canvasHeight: number,
) {
  const sourceWidth =
    "videoWidth" in source && source.videoWidth ? source.videoWidth : source.width ?? canvasWidth;
  const sourceHeight =
    "videoHeight" in source && source.videoHeight ? source.videoHeight : source.height ?? canvasHeight;
  const imageRatio = sourceWidth / sourceHeight;
  const canvasRatio = canvasWidth / canvasHeight;
  let drawWidth = canvasWidth;
  let drawHeight = canvasHeight;

  if (imageRatio > canvasRatio) {
    drawHeight = canvasWidth / imageRatio;
  } else {
    drawWidth = canvasHeight * imageRatio;
  }

  ctx.drawImage(
    source,
    (canvasWidth - drawWidth) / 2,
    (canvasHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

export function drawFrameBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.fillStyle = "#090d17";
  ctx.fillRect(0, 0, width, height);
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.4, 80, width * 0.5, height * 0.5, width * 0.8);
  gradient.addColorStop(0, "rgba(157,208,255,0.16)");
  gradient.addColorStop(0.55, "rgba(38,48,76,0.18)");
  gradient.addColorStop(1, "rgba(5,8,15,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function drawLabelStrip(
  ctx: CanvasRenderingContext2D,
  label: string,
  timecode: string,
  width: number,
  height: number,
) {
  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fillRect(0, height - 58, width, 58);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.font = "600 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(label.slice(0, 70), 28, height - 23);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "600 16px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "right";
  ctx.fillText(timecode, width - 28, height - 24);
}

export function drawVideoFallbackCard(
  ctx: CanvasRenderingContext2D,
  clip: VideoEditorClip,
  width: number,
  height: number,
  message = "External video source",
) {
  drawFrameBackground(ctx, width, height);
  ctx.fillStyle = "rgba(157,208,255,0.16)";
  ctx.strokeStyle = "rgba(157,208,255,0.42)";
  ctx.lineWidth = 2;
  const boxWidth = Math.min(520, width - 120);
  const boxHeight = 190;
  const x = (width - boxWidth) / 2;
  const y = (height - boxHeight) / 2;
  roundedRect(ctx, x, y, boxWidth, boxHeight, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Animatic clip", width / 2, y + 70);
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.font = "500 18px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(clip.label.slice(0, 54), width / 2, y + 110);
  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.font = "500 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(message, width / 2, y + 145);
}

export function drawSafeFrame(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(157,208,255,0.48)";
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(width * 0.05, height * 0.05, width * 0.9, height * 0.9);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.strokeRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loadVideoElement(src: string): Promise<HTMLVideoElement | null> {
  if (!isCanvasDrawableVideoSource(src)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    const done = (value: HTMLVideoElement | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timeout = window.setTimeout(() => done(null), 7000);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.onloadeddata = () => {
      window.clearTimeout(timeout);
      done(video);
    };
    video.onerror = () => {
      window.clearTimeout(timeout);
      done(null);
    };
    video.src = src;
    video.load();
  });
}

export async function exportVideoEditToWebM({
  clips,
  fps,
  width,
  height,
  onProgress,
}: ExportVideoEditOptions): Promise<Blob> {
  const durationMs = totalDurationMs(clips);
  if (durationMs <= 0) throw new Error("Nothing to export");

  onProgress?.(0, "Preparing media…");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const imageCache = new Map<string, HTMLImageElement>();
  const panelClips = clips.filter((clip) => clip.kind === "panel");
  await Promise.all(
    panelClips.map(async (clip, index) => {
      if (!imageCache.has(clip.src)) {
        try {
          imageCache.set(clip.src, await loadImageElement(clip.src));
        } catch {
          // The frame renderer will draw a fallback background.
        }
      }
      onProgress?.(Math.round(((index + 1) / Math.max(panelClips.length, 1)) * 12), "Loading panels…");
    }),
  );

  const videoCache = new Map<string, HTMLVideoElement>();
  const videoClips = clips.filter((clip) => clip.kind === "animatic" && isCanvasDrawableVideoSource(clip.src));
  await Promise.all(
    videoClips.map(async (clip, index) => {
      if (!videoCache.has(clip.src)) {
        const video = await loadVideoElement(clip.src);
        if (video) videoCache.set(clip.src, video);
      }
      onProgress?.(12 + Math.round(((index + 1) / Math.max(videoClips.length, 1)) * 10), "Loading videos…");
    }),
  );

  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: width >= 1920 ? 8_000_000 : 4_500_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  let activeVideoKey: string | null = null;
  recorder.start(100);
  const startTs = performance.now();
  const frameMs = 1000 / fps;
  let lastFrame = -frameMs;

  await new Promise<void>((resolve) => {
    const draw = () => {
      const elapsed = Math.min(durationMs, performance.now() - startTs);
      if (elapsed - lastFrame < frameMs && elapsed < durationMs) {
        requestAnimationFrame(draw);
        return;
      }
      lastFrame = elapsed;

      const info = findClipAtTime(clips, elapsed);
      drawFrameBackground(ctx, width, height);

      if (info?.clip.kind === "panel") {
        const img = imageCache.get(info.clip.src);
        if (img) drawContain(ctx, img, width, height);
        drawLabelStrip(ctx, info.clip.label, formatTimestamp(elapsed), width, height);
      } else if (info?.clip.kind === "animatic") {
        const video = videoCache.get(info.clip.src);
        if (video && video.readyState >= 2) {
          const targetSeconds = ((info.clip.trimStartMs ?? 0) + info.localMs) / 1000;
          if (activeVideoKey !== info.clip.id) {
            activeVideoKey = info.clip.id;
            video.currentTime = targetSeconds;
            video.play().catch(() => {});
          } else if (Math.abs(video.currentTime - targetSeconds) > 0.4) {
            video.currentTime = targetSeconds;
          }
          try {
            drawContain(ctx, video, width, height);
          } catch {
            drawVideoFallbackCard(ctx, info.clip, width, height, "Video could not be drawn to canvas");
          }
        } else {
          drawVideoFallbackCard(ctx, info.clip, width, height);
        }
        drawLabelStrip(ctx, info.clip.label, formatTimestamp(elapsed), width, height);
      }

      onProgress?.(
        Math.min(98, 22 + Math.round((elapsed / durationMs) * 74)),
        `Rendering ${formatTimestamp(elapsed)} / ${formatTimestamp(durationMs)}…`,
      );

      if (elapsed >= durationMs) {
        Array.from(videoCache.values()).forEach((video) => video.pause());
        recorder.stop();
        return;
      }
      requestAnimationFrame(draw);
    };
    recorder.onstop = () => resolve();
    requestAnimationFrame(draw);
  });

  onProgress?.(100, "Export complete");
  return new Blob(chunks, { type: "video/webm" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1200);
}
