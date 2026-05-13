/**
 * Animatic Playback Engine
 *
 * Manages RAF-based playhead, HTMLAudioElement per clip,
 * and Web Audio API for gain/fade.
 */
import type { AnimaticTrackData, AnimaticClipData } from "./types";

interface AudioNode_ {
  audioEl: HTMLAudioElement;
  gainNode: GainNode;
  sourceNode: MediaElementAudioSourceNode;
  clipId: number;
  trackId: number;
  startMs: number;
  durationMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  baseVolume: number; // clip.volume × track.volume × master
  isPlaying: boolean;
}

export class PlaybackEngine {
  private tracks: AnimaticTrackData[] = [];
  private totalDurationMs = 8000;
  private currentMs = 0;
  private playing = false;
  private lastTimestamp: number | null = null;
  private rafHandle: number | null = null;
  private masterVolume = 1.0;

  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private audioNodes = new Map<number, AudioNode_>(); // clipId -> node
  private clipsById = new Map<number, AnimaticClipData>();
  private tracksByClipId = new Map<number, AnimaticTrackData>();

  private onTimeUpdate: ((ms: number) => void) | null = null;
  private onPanelChange: ((clipId: number | null) => void) | null = null;
  private currentPanelClipId: number | null = null;

  constructor(
    tracks: AnimaticTrackData[],
    totalDurationMs: number,
    onTimeUpdate: (ms: number) => void,
    onPanelChange: (clipId: number | null) => void,
  ) {
    this.tracks = tracks;
    this.totalDurationMs = totalDurationMs;
    this.onTimeUpdate = onTimeUpdate;
    this.onPanelChange = onPanelChange;
    this.rebuildLookups();
  }

  private getOrCreateAudioCtx(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === "closed") {
      this.audioCtx = new AudioContext();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.audioCtx.destination);
    }
    return this.audioCtx;
  }

  /** Call after track/clip data changes to re-build audio elements */
  updateTracks(tracks: AnimaticTrackData[], totalDurationMs: number) {
    this.tracks = tracks;
    this.totalDurationMs = totalDurationMs;
    this.rebuildLookups();
    // Dispose old audio nodes that no longer exist
    const clipIds = new Set(tracks.flatMap((t) => t.clips.map((c) => c.id)));
    for (const [id, node] of this.audioNodes) {
      if (!clipIds.has(id)) {
        node.audioEl.pause();
        node.audioEl.src = "";
        this.audioNodes.delete(id);
      }
    }
    // Re-apply current time (will also re-configure audio nodes)
    this.seek(this.currentMs);
  }

  setMasterVolume(v: number) {
    this.masterVolume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  play() {
    if (this.playing) return;
    if (this.currentMs >= this.totalDurationMs) this.seek(0);
    this.playing = true;
    this.lastTimestamp = null;
    // Resume AudioContext if suspended
    if (this.audioCtx?.state === "suspended") this.audioCtx.resume();
    this.scheduleAudio();
    this.rafHandle = requestAnimationFrame(this.tick);
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    if (this.rafHandle != null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    // Pause all audio
    for (const node of this.audioNodes.values()) {
      if (node.isPlaying) {
        node.audioEl.pause();
        node.isPlaying = false;
      }
    }
  }

  seek(ms: number) {
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    this.currentMs = Math.max(0, Math.min(ms, this.totalDurationMs));
    this.onTimeUpdate?.(this.currentMs);
    this.updatePanelDisplay();
    // Seek audio elements if they exist
    for (const node of this.audioNodes.values()) {
      const clip = this.findClip(node.clipId);
      if (!clip) continue;
      const relativeMs = this.currentMs - clip.startMs;
      if (relativeMs >= 0 && relativeMs < clip.durationMs) {
        node.audioEl.currentTime = relativeMs / 1000;
      }
    }
    if (wasPlaying) this.play();
  }

  getCurrentMs(): number {
    return this.currentMs;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  private tick = (timestamp: number) => {
    if (!this.playing) return;
    if (this.lastTimestamp == null) this.lastTimestamp = timestamp;
    const elapsed = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    this.currentMs = Math.min(this.currentMs + elapsed, this.totalDurationMs);
    this.onTimeUpdate?.(this.currentMs);
    this.updatePanelDisplay();
    this.updateAudio();

    if (this.currentMs >= this.totalDurationMs) {
      this.pause();
      return;
    }
    this.rafHandle = requestAnimationFrame(this.tick);
  };

  private updatePanelDisplay() {
    const panelTrack = this.tracks.find((t) => t.kind === "panel");
    if (!panelTrack) return;
    const activeClip = panelTrack.clips.find(
      (c) => this.currentMs >= c.startMs && this.currentMs < c.startMs + c.durationMs,
    );
    const newId = activeClip?.id ?? null;
    if (newId !== this.currentPanelClipId) {
      this.currentPanelClipId = newId;
      this.onPanelChange?.(newId);
    }
  }

  private findClip(clipId: number): AnimaticClipData | undefined {
    return this.clipsById.get(clipId);
  }

  private findTrackForClip(clipId: number): AnimaticTrackData | undefined {
    return this.tracksByClipId.get(clipId);
  }

  private rebuildLookups() {
    this.clipsById.clear();
    this.tracksByClipId.clear();
    for (const track of this.tracks) {
      for (const clip of track.clips) {
        this.clipsById.set(clip.id, clip);
        this.tracksByClipId.set(clip.id, track);
      }
    }
  }

  /** Start/stop audio elements based on playhead position */
  private updateAudio() {
    const ctx = this.getOrCreateAudioCtx();

    for (const track of this.tracks) {
      if (track.muted) {
        // Mute any playing clips on this track
        for (const clip of track.clips) {
          const node = this.audioNodes.get(clip.id);
          if (node?.isPlaying) {
            node.audioEl.pause();
            node.isPlaying = false;
          }
        }
        continue;
      }

      for (const clip of track.clips) {
        if (!clip.resolvedAudioUrl) continue;
        const inRange =
          this.currentMs >= clip.startMs && this.currentMs < clip.startMs + clip.durationMs;

        let node = this.audioNodes.get(clip.id);

        if (inRange && this.playing) {
          if (!node) {
            // Create audio element and web audio chain
            const audioEl = new Audio();
            audioEl.src = clip.resolvedAudioUrl;
            audioEl.preload = "auto";
            audioEl.crossOrigin = "anonymous";

            const baseVol =
              parseFloat(clip.volume) * parseFloat(track.volume) * this.masterVolume;

            let gainNode: GainNode;
            let sourceNode: MediaElementAudioSourceNode;
            try {
              sourceNode = ctx.createMediaElementSource(audioEl);
              gainNode = ctx.createGain();
              gainNode.gain.value = baseVol;
              sourceNode.connect(gainNode);
              gainNode.connect(this.masterGain!);
            } catch {
              // If already connected or other error, skip web audio
              gainNode = ctx.createGain();
              sourceNode = ctx.createMediaElementSource(new Audio());
            }

            node = {
              audioEl,
              gainNode,
              sourceNode,
              clipId: clip.id,
              trackId: track.id,
              startMs: clip.startMs,
              durationMs: clip.durationMs,
              fadeInMs: clip.fadeInMs,
              fadeOutMs: clip.fadeOutMs,
              baseVolume: baseVol,
              isPlaying: false,
            };
            this.audioNodes.set(clip.id, node);
          }

          if (!node.isPlaying) {
            const relativeMs = this.currentMs - clip.startMs;
            node.audioEl.currentTime = relativeMs / 1000;
            node.audioEl.play().catch(() => {});
            node.isPlaying = true;
          }

          // Apply fade in/out gain
          const relMs = this.currentMs - clip.startMs;
          const endMs = clip.durationMs;
          let vol = node.baseVolume;
          if (clip.fadeInMs > 0 && relMs < clip.fadeInMs) {
            vol *= relMs / clip.fadeInMs;
          }
          if (clip.fadeOutMs > 0 && relMs > endMs - clip.fadeOutMs) {
            vol *= (endMs - relMs) / clip.fadeOutMs;
          }
          try {
            node.gainNode.gain.value = Math.max(0, Math.min(1, vol));
          } catch {}
        } else if (node?.isPlaying) {
          node.audioEl.pause();
          node.isPlaying = false;
        }
      }
    }
  }

  /** Pre-schedule audio when play starts — sets correct currentTime */
  private scheduleAudio() {
    for (const track of this.tracks) {
      for (const clip of track.clips) {
        if (!clip.resolvedAudioUrl) continue;
        const inRange =
          this.currentMs >= clip.startMs && this.currentMs < clip.startMs + clip.durationMs;
        if (inRange) {
          const node = this.audioNodes.get(clip.id);
          if (node) {
            node.audioEl.currentTime = (this.currentMs - clip.startMs) / 1000;
          }
        }
      }
    }
  }

  dispose() {
    this.pause();
    for (const node of this.audioNodes.values()) {
      node.audioEl.pause();
      node.audioEl.src = "";
    }
    this.audioNodes.clear();
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
  }
}
