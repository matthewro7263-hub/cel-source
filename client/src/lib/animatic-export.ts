/**
 * Animatic MP4 / WebM export
 *
 * Strategy: Use MediaRecorder API to capture a Canvas stream + Web Audio
 * destination stream, recording the entire playback in real-time.
 * This avoids ffmpeg.wasm's heavy WASM bundle (~30MB) and is more reliable
 * in sandboxed iframes.
 *
 * Output: WebM (VP8/Opus) — playable in Chrome, Firefox, VLC, ffmpeg.
 * Note documented in UI.
 */

export interface ExportTrackData {
  id: number;
  kind: string;
  muted: boolean;
  volume: number;
  clips: ExportClipData[];
}

export interface ExportClipData {
  id: number;
  startMs: number;
  durationMs: number;
  sourceKind: string;
  imageUrl?: string; // resolved panel image data URL
  audioUrl?: string; // resolved audio data URL or Freesound preview URL
  label: string;
  fadeInMs: number;
  fadeOutMs: number;
  volume: number;
}

export interface ExportOptions {
  title: string;
  fps: number;
  totalDurationMs: number;
  masterVolume: number;
  tracks: ExportTrackData[];
  onProgress?: (pct: number, status: string) => void;
  signal?: AbortSignal;
}

/**
 * Export the animatic to WebM using MediaRecorder.
 * Returns a Blob with MIME type video/webm.
 */
export async function exportAnimaticToWebM(opts: ExportOptions): Promise<Blob> {
  const { title, fps, totalDurationMs, masterVolume, tracks, onProgress, signal } = opts;

  onProgress?.(0, "Preparing export…");

  // Canvas setup — 1280x720 (720p 16:9)
  const W = 1280;
  const H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Web Audio setup
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = masterVolume;
  masterGain.connect(dest);

  // Pre-load all audio buffers
  const audioSources = new Map<string, AudioBuffer>();
  const allAudioClips = tracks.flatMap((t) =>
    t.clips.filter((c) => c.audioUrl && (c.sourceKind === "audio_data" || c.sourceKind === "asset_ref")),
  );

  let loaded = 0;
  for (const clip of allAudioClips) {
    if (clip.audioUrl && !audioSources.has(clip.audioUrl)) {
      try {
        const response = await fetch(clip.audioUrl);
        const arrayBuf = await response.arrayBuffer();
        const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
        audioSources.set(clip.audioUrl, audioBuf);
      } catch {
        // Skip unloadable audio
      }
    }
    loaded++;
    onProgress?.(Math.round((loaded / Math.max(allAudioClips.length, 1)) * 10), "Loading audio…");
    if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
  }

  onProgress?.(10, "Recording…");

  // Combine canvas + audio streams
  const canvasStream = canvas.captureStream(fps);
  const audioTracks = dest.stream.getAudioTracks();
  for (const t of audioTracks) canvasStream.addTrack(t);

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(canvasStream, {
    mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm",
    videoBitsPerSecond: 4_000_000,
  });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start(100); // collect chunks every 100ms

  // Playback loop — render each frame
  const frameDuration = 1000 / fps;
  const totalFrames = Math.ceil((totalDurationMs / 1000) * fps);

  // Resolve panel images
  const panelClips = tracks
    .find((t) => t.kind === "panel")
    ?.clips.filter((c) => c.sourceKind === "panel_ref" && c.imageUrl) ?? [];

  // Schedule all audio clips
  const startTime = audioCtx.currentTime + 0.1; // small buffer
  for (const track of tracks) {
    if (track.muted) continue;
    const trackVol = track.volume;
    for (const clip of track.clips) {
      if (!clip.audioUrl) continue;
      const audioBuf = audioSources.get(clip.audioUrl);
      if (!audioBuf) continue;

      const clipStartTime = startTime + clip.startMs / 1000;
      const clipVol = clip.volume * trackVol * masterVolume;

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuf;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = clipVol;

      // Fade in
      if (clip.fadeInMs > 0) {
        gainNode.gain.setValueAtTime(0, clipStartTime);
        gainNode.gain.linearRampToValueAtTime(clipVol, clipStartTime + clip.fadeInMs / 1000);
      }
      // Fade out
      if (clip.fadeOutMs > 0) {
        const fadeOutStart = clipStartTime + clip.durationMs / 1000 - clip.fadeOutMs / 1000;
        gainNode.gain.setValueAtTime(clipVol, Math.max(clipStartTime, fadeOutStart));
        gainNode.gain.linearRampToValueAtTime(0, clipStartTime + clip.durationMs / 1000);
      }

      source.connect(gainNode);
      gainNode.connect(masterGain);
      source.start(clipStartTime);
      source.stop(clipStartTime + clip.durationMs / 1000);
    }
  }

  // Wait for the scheduled start time then render frames
  await new Promise<void>((resolve) => {
    const waitMs = Math.max(0, (startTime - audioCtx.currentTime) * 1000 - 50);
    setTimeout(resolve, waitMs);
  });

  // Render frames in real-time (we can't go faster without breaking audio sync)
  for (let frame = 0; frame < totalFrames; frame++) {
    if (signal?.aborted) {
      recorder.stop();
      await audioCtx.close();
      throw new DOMException("Export cancelled", "AbortError");
    }

    const currentMs = frame * frameDuration;

    // Find current panel image
    const activePanel = panelClips
      .filter((c) => c.imageUrl && currentMs >= c.startMs && currentMs < c.startMs + c.durationMs)
      .sort((a, b) => b.startMs - a.startMs)[0];

    // Draw frame
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, W, H);

    if (activePanel?.imageUrl) {
      const img = new Image();
      img.src = activePanel.imageUrl;
      // Draw synchronously — image should already be in browser cache
      try {
        ctx.drawImage(img, 0, 0, W, H);
      } catch {
        // Fallback: gradient placeholder
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, "#1a1a2e");
        grad.addColorStop(1, "#16213e");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      // Black frame
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
    }

    // Draw timecode overlay
    const secTotal = currentMs / 1000;
    const mm = Math.floor(secTotal / 60).toString().padStart(2, "0");
    const ss = Math.floor(secTotal % 60).toString().padStart(2, "0");
    const cc = Math.floor((secTotal % 1) * 100).toString().padStart(2, "0");
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(W - 130, H - 36, 120, 28);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 16px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${mm}:${ss}.${cc}`, W - 14, H - 14);

    const pct = 10 + Math.round((frame / totalFrames) * 85);
    onProgress?.(pct, `Rendering frame ${frame + 1} / ${totalFrames}…`);

    // Wait one frame duration to maintain real-time sync
    await new Promise<void>((r) => setTimeout(r, frameDuration));
  }

  onProgress?.(95, "Finalizing…");

  // Stop recorder and collect remaining chunks
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.stop();
  });

  await audioCtx.close();

  onProgress?.(100, "Done!");

  return new Blob(chunks, { type: "video/webm" });
}

/** Trigger browser download */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
