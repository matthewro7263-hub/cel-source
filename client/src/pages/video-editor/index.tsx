// Cel — Video Editor
// A timeline-based editor for stitching storyboard panels and animatic clips
// into a playable sequence. Exports WebM via canvas + MediaRecorder.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  Clock,
  Copy,
  Download,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  ListPlus,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  DEFAULT_ANIMATIC_MS,
  DEFAULT_PANEL_MS,
  DEFAULT_PX_PER_SECOND,
  findClipAtTime,
  formatTimestamp,
  getClipSpans,
  duplicateClip,
  moveClipById,
  sanitizeDurationMs,
  splitClipAtPlayhead,
  totalDurationMs,
  type VideoEditorClip,
} from "./model";
import {
  downloadBlob,
  drawContain,
  drawFrameBackground,
  drawLabelStrip,
  drawSafeFrame,
  drawVideoFallbackCard,
  exportVideoEditToWebM,
  isCanvasDrawableVideoSource,
  loadImageElement,
  probeVideoDurationMs,
} from "./media";
import { ToolSurface, ToolWorkspace } from "@/components/layout/tool-workspace";

interface Panel {
  id: number;
  storyboardId: number;
  orderIdx: number;
  imageData: string;
  caption: string;
  dialogue: string;
}

interface Storyboard {
  id: number;
  projectId: number;
  title: string;
  panels?: Panel[];
}

interface Animatic {
  id: number;
  projectId: number;
  title: string;
  videoData: string;
  notes: string;
}

interface ExportState {
  progress: number;
  status: string;
}

interface ResizeState {
  clipId: string;
  startX: number;
  originalDurationMs: number;
  originalClips: VideoEditorClip[];
}

const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 720;
const HISTORY_LIMIT = 50;

const EXPORT_RESOLUTIONS = [
  { label: "720p", width: 1280, height: 720 },
  { label: "1080p", width: 1920, height: 1080 },
];

function createClipId(prefix = "clip") {
  return `${prefix}-${Date.now()}-${crypto.randomUUID()}`;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export default function VideoEditor() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = Number(projectId);
  const [, navigate] = useLocation();

  const { data: storyboardsData = [] } = useQuery<Storyboard[]>({
    queryKey: [`/api/projects/${pid}/storyboards`],
    enabled: Number.isFinite(pid),
  });
  const { data: animaticsData = [] } = useQuery<Animatic[]>({
    queryKey: [`/api/projects/${pid}/animatics`],
    enabled: Number.isFinite(pid),
  });

  const storyboards = Array.isArray(storyboardsData) ? storyboardsData : [];
  const animatics = Array.isArray(animaticsData) ? animaticsData : [];
  const allPanels = useMemo(
    () =>
      storyboards
        .flatMap((storyboard) => storyboard.panels ?? [])
        .sort((a, b) => a.storyboardId - b.storyboardId || a.orderIdx - b.orderIdx),
    [storyboards],
  );

  const [clips, setClips] = useState<VideoEditorClip[]>([]);
  const [past, setPast] = useState<VideoEditorClip[][]>([]);
  const [future, setFuture] = useState<VideoEditorClip[][]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loopPlayback, setLoopPlayback] = useState(false);
  const [showSafeFrame, setShowSafeFrame] = useState(true);
  const [pxPerSecond, setPxPerSecond] = useState(DEFAULT_PX_PER_SECOND);
  const [exportState, setExportState] = useState<ExportState | null>(null);
  const [exportResolutionIndex, setExportResolutionIndex] = useState(0);
  const [videoDurations, setVideoDurations] = useState<Record<number, number>>({});
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [previewTick, setPreviewTick] = useState(0);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const imgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  const totalMs = useMemo(() => totalDurationMs(clips), [clips]);
  const clipSpans = useMemo(() => getClipSpans(clips), [clips]);
  const selectedClip = useMemo(
    () => clips.find((clip) => clip.id === selectedClipId) ?? null,
    [clips, selectedClipId],
  );
  const currentClipInfo = useMemo(
    () => findClipAtTime(clips, playheadMs),
    [clips, playheadMs],
  );

  const commitClips = useCallback(
    (
      updater: VideoEditorClip[] | ((previous: VideoEditorClip[]) => VideoEditorClip[]),
      options: { selectedClipId?: string | null; playheadMs?: number } = {},
    ) => {
      setClips((previous) => {
        const next = typeof updater === "function" ? updater(previous) : updater;
        if (next === previous) return previous;
        setPast((items) => [...items, previous].slice(-HISTORY_LIMIT));
        setFuture([]);
        if ("selectedClipId" in options) setSelectedClipId(options.selectedClipId ?? null);
        if (typeof options.playheadMs === "number") {
          setPlayheadMs(Math.max(0, Math.min(options.playheadMs, totalDurationMs(next))));
        } else {
          setPlayheadMs((value) => Math.max(0, Math.min(value, totalDurationMs(next))));
        }
        return next;
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setPast((items) => {
      if (items.length === 0) return items;
      const previous = items[items.length - 1];
      setFuture((futureItems) => [clips, ...futureItems].slice(0, HISTORY_LIMIT));
      setClips(previous);
      setSelectedClipId(null);
      setPlayheadMs((value) => Math.min(value, totalDurationMs(previous)));
      return items.slice(0, -1);
    });
  }, [clips]);

  const redo = useCallback(() => {
    setFuture((items) => {
      if (items.length === 0) return items;
      const next = items[0];
      setPast((pastItems) => [...pastItems, clips].slice(-HISTORY_LIMIT));
      setClips(next);
      setSelectedClipId(null);
      setPlayheadMs((value) => Math.min(value, totalDurationMs(next)));
      return items.slice(1);
    });
  }, [clips]);

  useEffect(() => {
    setPlayheadMs((value) => Math.max(0, Math.min(value, totalMs)));
    if (selectedClipId && !clips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(null);
    }
  }, [clips, selectedClipId, totalMs]);

  useEffect(() => {
    let cancelled = false;
    animatics.forEach((animatic) => {
      if (videoDurations[animatic.id]) return;
      probeVideoDurationMs(animatic.videoData).then((durationMs) => {
        if (cancelled || !durationMs) return;
        setVideoDurations((current) => ({ ...current, [animatic.id]: durationMs }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [animatics, videoDurations]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastTickRef.current = performance.now();
    const tick = () => {
      const now = performance.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setPlayheadMs((value) => {
        const next = value + delta;
        if (next >= totalMs) {
          if (loopPlayback && totalMs > 0) return 0;
          setPlaying(false);
          return totalMs;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loopPlayback, playing, totalMs]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    const bump = () => setPreviewTick((value) => value + 1);
    video.addEventListener("loadeddata", bump);
    video.addEventListener("seeked", bump);
    video.addEventListener("timeupdate", bump);
    return () => {
      video.removeEventListener("loadeddata", bump);
      video.removeEventListener("seeked", bump);
      video.removeEventListener("timeupdate", bump);
    };
  }, []);

  useEffect(() => {
    const video = previewVideoRef.current;
    const clip = currentClipInfo?.clip;
    if (!video || !clip || clip.kind !== "animatic" || !isCanvasDrawableVideoSource(clip.src)) {
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      return;
    }

    if (video.dataset.src !== clip.src) {
      video.dataset.src = clip.src;
      video.src = clip.src;
      video.load();
    }

    const targetSeconds = ((clip.trimStartMs ?? 0) + (currentClipInfo?.localMs ?? 0)) / 1000;
    if (!playing || Math.abs(video.currentTime - targetSeconds) > 0.35) {
      try {
        video.currentTime = targetSeconds;
      } catch {
        // Some videos reject seeks before metadata; loadeddata will redraw.
      }
    }
    if (playing) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [currentClipInfo, playing]);

  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawFrameBackground(ctx, PREVIEW_WIDTH, PREVIEW_HEIGHT);

    if (!currentClipInfo) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "600 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Add panels or animatics to start cutting.", PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2);
      return;
    }

    const { clip, localMs } = currentClipInfo;
    if (clip.kind === "panel") {
      const cached = imgCacheRef.current.get(clip.src);
      if (cached) {
        drawContain(ctx, cached, PREVIEW_WIDTH, PREVIEW_HEIGHT);
      } else {
        loadImageElement(clip.src)
          .then((img) => {
            imgCacheRef.current.set(clip.src, img);
            setPreviewTick((value) => value + 1);
          })
          .catch(() => {});
      }
    } else {
      const video = previewVideoRef.current;
      if (video && video.readyState >= 2 && isCanvasDrawableVideoSource(clip.src)) {
        try {
          drawContain(ctx, video, PREVIEW_WIDTH, PREVIEW_HEIGHT);
        } catch {
          drawVideoFallbackCard(ctx, clip, PREVIEW_WIDTH, PREVIEW_HEIGHT, "Video could not be drawn to canvas");
        }
      } else {
        drawVideoFallbackCard(
          ctx,
          clip,
          PREVIEW_WIDTH,
          PREVIEW_HEIGHT,
          isCanvasDrawableVideoSource(clip.src) ? "Loading video frame…" : "External video link preview",
        );
      }
    }

    if (showSafeFrame) drawSafeFrame(ctx, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    drawLabelStrip(
      ctx,
      clip.label,
      `${formatTimestamp(playheadMs)} · ${formatTimestamp(localMs)}`,
      PREVIEW_WIDTH,
      PREVIEW_HEIGHT,
    );
  }, [currentClipInfo, playheadMs, previewTick, showSafeFrame]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  useEffect(() => {
    if (!resizeState) return;
    const handleMove = (event: MouseEvent) => {
      const deltaMs = ((event.clientX - resizeState.startX) / pxPerSecond) * 1000;
      const nextDuration = sanitizeDurationMs(resizeState.originalDurationMs + deltaMs);
      setClips((current) =>
        current.map((clip) =>
          clip.id === resizeState.clipId
            ? { ...clip, durationMs: nextDuration }
            : clip,
        ),
      );
    };
    const handleUp = () => {
      setPast((items) => [...items, resizeState.originalClips].slice(-HISTORY_LIMIT));
      setFuture([]);
      setResizeState(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp, { once: true });
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [pxPerSecond, resizeState]);

  const seekTo = useCallback(
    (ms: number) => setPlayheadMs(Math.max(0, Math.min(ms, totalMs))),
    [totalMs],
  );

  const stepBy = useCallback(
    (deltaMs: number) => seekTo(playheadMs + deltaMs),
    [playheadMs, seekTo],
  );

  const scrubTimeline = useCallback(
    (clientX: number) => {
      const el = timelineRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, clientX - rect.left + el.scrollLeft - 12);
      seekTo((x / pxPerSecond) * 1000);
    },
    [pxPerSecond, seekTo],
  );

  const addPanelClip = useCallback(
    (panel: Panel) => {
      const id = createClipId("panel");
      commitClips(
        (current) => [
          ...current,
          {
            id,
            kind: "panel",
            src: panel.imageData,
            label: panel.caption || panel.dialogue || `Panel ${panel.orderIdx + 1}`,
            durationMs: DEFAULT_PANEL_MS,
          },
        ],
        { selectedClipId: id },
      );
    },
    [commitClips],
  );

  const addPanels = useCallback(
    (panels: Panel[], labelPrefix?: string) => {
      if (panels.length === 0) return;
      const newClips = panels.map((panel, index): VideoEditorClip => ({
        id: createClipId("panel"),
        kind: "panel",
        src: panel.imageData,
        label: panel.caption || panel.dialogue || `${labelPrefix ?? "Panel"} ${index + 1}`,
        durationMs: DEFAULT_PANEL_MS,
      }));
      commitClips((current) => [...current, ...newClips], {
        selectedClipId: newClips[0]?.id ?? null,
      });
    },
    [commitClips],
  );

  const addAnimaticClip = useCallback(
    (animatic: Animatic) => {
      const id = createClipId("animatic");
      const sourceDurationMs = videoDurations[animatic.id];
      commitClips(
        (current) => [
          ...current,
          {
            id,
            kind: "animatic",
            src: animatic.videoData,
            label: animatic.title,
            durationMs: sanitizeDurationMs(sourceDurationMs ?? DEFAULT_ANIMATIC_MS),
            sourceDurationMs,
            trimStartMs: 0,
          },
        ],
        { selectedClipId: id },
      );
    },
    [commitClips, videoDurations],
  );

  const updateClip = useCallback(
    (clipId: string, patch: Partial<VideoEditorClip>) => {
      commitClips((current) =>
        current.map((clip) =>
          clip.id === clipId
            ? {
                ...clip,
                ...patch,
                durationMs: patch.durationMs !== undefined
                  ? sanitizeDurationMs(patch.durationMs)
                  : clip.durationMs,
              }
            : clip,
        ),
      );
    },
    [commitClips],
  );

  const removeClip = useCallback(
    (clipId: string) => {
      commitClips((current) => current.filter((clip) => clip.id !== clipId), {
        selectedClipId: selectedClipId === clipId ? null : selectedClipId,
      });
    },
    [commitClips, selectedClipId],
  );

  const duplicateSelected = useCallback(() => {
    if (!selectedClipId) return;
    const newId = createClipId("copy");
    commitClips((current) => duplicateClip(current, selectedClipId, () => newId), {
      selectedClipId: newId,
    });
  }, [commitClips, selectedClipId]);

  const splitSelected = useCallback(() => {
    if (!selectedClipId) return;
    const next = splitClipAtPlayhead(
      clips,
      selectedClipId,
      playheadMs,
      (suffix) => `${createClipId("split")}-${suffix}`,
    );
    commitClips(next.clips, { selectedClipId: next.selectedClipId });
  }, [clips, commitClips, playheadMs, selectedClipId]);

  const moveSelected = useCallback(
    (direction: -1 | 1) => {
      if (!selectedClipId) return;
      commitClips((current) => moveClipById(current, selectedClipId, direction), {
        selectedClipId,
      });
    },
    [commitClips, selectedClipId],
  );

  const clearTimeline = useCallback(() => {
    commitClips([], { selectedClipId: null, playheadMs: 0 });
    setPlaying(false);
  }, [commitClips]);

  const handleExport = useCallback(async () => {
    if (clips.length === 0 || exportState) return;
    const resolution = EXPORT_RESOLUTIONS[exportResolutionIndex] ?? EXPORT_RESOLUTIONS[0];
    setPlaying(false);
    setExportState({ progress: 0, status: "Preparing export…" });
    try {
      const blob = await exportVideoEditToWebM({
        clips,
        fps: 30,
        width: resolution.width,
        height: resolution.height,
        onProgress: (progress, status) => setExportState({ progress, status }),
      });
      downloadBlob(blob, `cel-edit-${pid}-${Date.now()}.webm`);
      setExportState({ progress: 100, status: "Downloaded WebM" });
      window.setTimeout(() => setExportState(null), 1400);
    } catch (error) {
      setExportState({
        progress: 0,
        status: error instanceof Error ? error.message : "Export failed",
      });
      window.setTimeout(() => setExportState(null), 2400);
    }
  }, [clips, exportResolutionIndex, exportState, pid]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (totalMs > 0) {
          if (playheadMs >= totalMs) seekTo(0);
          setPlaying((value) => !value);
        }
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        stepBy(event.shiftKey ? -1000 : -100);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        stepBy(event.shiftKey ? 1000 : 100);
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        splitSelected();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedClipId) {
          event.preventDefault();
          removeClip(selectedClipId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playheadMs, redo, removeClip, seekTo, selectedClipId, splitSelected, stepBy, totalMs, undo]);

  const timelineWidth = Math.max(900, Math.ceil((totalMs / 1000) * pxPerSecond) + 240);
  const rulerTicks = useMemo(() => {
    const interval = pxPerSecond >= 140 ? 500 : pxPerSecond >= 72 ? 1000 : pxPerSecond >= 44 ? 2000 : 5000;
    const count = Math.ceil(Math.max(totalMs, 10_000) / interval) + 1;
    return Array.from({ length: count }, (_, index) => {
      const ms = index * interval;
      return {
        ms,
        left: 12 + (ms / 1000) * pxPerSecond,
        major: ms % 1000 === 0,
      };
    });
  }, [pxPerSecond, totalMs]);

  const canSplitSelected = Boolean(
    selectedClipId &&
      currentClipInfo?.clip.id === selectedClipId &&
      currentClipInfo.localMs >= 100 &&
      currentClipInfo.endMs - playheadMs >= 100,
  );

  return (
    <ToolWorkspace
      backAction={
        <button
          type="button"
          onClick={() => navigate(`/projects/${pid}`)}
          className="btn-ghost inline-flex items-center gap-2"
        >
          <ChevronLeft size={16} />
          Back to project
        </button>
      }
      title="Video Editor"
      icon={<Film size={18} className="text-primary" />}
      badge={<span className="chip chip-sky">Timeline</span>}
      meta={
        <>
          <span>{clips.length} clip{clips.length === 1 ? "" : "s"}</span>
          <span>•</span>
          <span className="font-mono">{formatTimestamp(totalMs)}</span>
          {selectedClip && (
            <>
              <span>•</span>
              <span className="truncate">Selected: {selectedClip.label}</span>
            </>
          )}
        </>
      }
      actions={
        <>
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-2"
            disabled={past.length === 0}
            onClick={undo}
          >
            <Undo2 size={15} />
            Undo
          </button>
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-2"
            disabled={future.length === 0}
            onClick={redo}
          >
            <Redo2 size={15} />
            Redo
          </button>
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-2"
            disabled={clips.length === 0}
            onClick={clearTimeline}
          >
            <RotateCcw size={15} />
            Clear
          </button>
          <select
            aria-label="Export resolution"
            value={exportResolutionIndex}
            onChange={(event) => setExportResolutionIndex(Number(event.target.value))}
            className="h-10 px-3 text-sm"
          >
            {EXPORT_RESOLUTIONS.map((resolution, index) => (
              <option key={resolution.label} value={index}>
                {resolution.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-sky"
            disabled={clips.length === 0 || exportState !== null}
            onClick={handleExport}
          >
            <Download size={16} />
            {exportState ? `${exportState.progress}%` : "Export WebM"}
          </button>
        </>
      }
      main={
        <>
          {exportState && (
            <ToolSurface className="p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span>{exportState.status}</span>
                <span className="font-mono text-xs text-muted-foreground">{exportState.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-[#9DD0FF] transition-all"
                  style={{ width: `${exportState.progress}%` }}
                />
              </div>
            </ToolSurface>
          )}

          <ToolSurface className="overflow-hidden">
              <canvas
                ref={previewCanvasRef}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                className="block w-full bg-black"
                style={{ aspectRatio: "16 / 9" }}
              />
              <video ref={previewVideoRef} className="hidden" muted playsInline />
              <div
                className="flex flex-wrap items-center gap-2 border-t px-4 py-3"
                style={{ borderColor: "var(--card-border)" }}
              >
                <button
                  type="button"
                  className="btn-sky"
                  disabled={totalMs === 0}
                  onClick={() => {
                    if (playheadMs >= totalMs) seekTo(0);
                    setPlaying((value) => !value);
                  }}
                >
                  {playing ? <Pause size={16} /> : <Play size={16} />}
                  {playing ? "Pause" : "Play"}
                </button>
                <button
                  type="button"
                  className="btn-ghost inline-flex items-center gap-2"
                  disabled={totalMs === 0}
                  onClick={() => {
                    setPlaying(false);
                    seekTo(0);
                  }}
                >
                  <Square size={14} />
                  Stop
                </button>
                <button
                  type="button"
                  className="btn-ghost inline-flex items-center gap-2"
                  disabled={totalMs === 0}
                  onClick={() => stepBy(-1000)}
                  title="Step back one second"
                >
                  <SkipBack size={14} />
                </button>
                <button
                  type="button"
                  className="btn-ghost inline-flex items-center gap-2"
                  disabled={totalMs === 0}
                  onClick={() => stepBy(1000)}
                  title="Step forward one second"
                >
                  <SkipForward size={14} />
                </button>
                <div className="min-w-[150px] font-mono text-sm tabular-nums text-muted-foreground">
                  {formatTimestamp(playheadMs)} / {formatTimestamp(totalMs)}
                </div>
                <input
                  aria-label="Playhead"
                  type="range"
                  min={0}
                  max={Math.max(totalMs, 1)}
                  value={Math.min(playheadMs, totalMs)}
                  onChange={(event) => seekTo(Number(event.target.value))}
                  className="min-w-[180px] flex-1"
                />
                <button
                  type="button"
                  className="btn-ghost inline-flex items-center gap-2"
                  onClick={() => setLoopPlayback((value) => !value)}
                  aria-pressed={loopPlayback}
                >
                  <RotateCcw size={14} />
                  {loopPlayback ? "Loop on" : "Loop"}
                </button>
                <button
                  type="button"
                  className="btn-ghost inline-flex items-center gap-2"
                  onClick={() => setShowSafeFrame((value) => !value)}
                  aria-pressed={showSafeFrame}
                >
                  {showSafeFrame ? <Eye size={14} /> : <EyeOff size={14} />}
                  Safe
                </button>
              </div>
          </ToolSurface>

          <ToolSurface className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Timeline</div>
                  <div className="mt-1 text-sm text-muted-foreground">Click to seek, drag clip edges to resize, use S to split.</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-ghost inline-flex items-center gap-2"
                    onClick={() => setPxPerSecond((value) => Math.max(36, value - 12))}
                  >
                    <ZoomOut size={14} />
                  </button>
                  <input
                    aria-label="Timeline zoom"
                    type="range"
                    min={36}
                    max={180}
                    step={6}
                    value={pxPerSecond}
                    onChange={(event) => setPxPerSecond(Number(event.target.value))}
                    className="w-28"
                  />
                  <button
                    type="button"
                    className="btn-ghost inline-flex items-center gap-2"
                    onClick={() => setPxPerSecond((value) => Math.min(180, value + 12))}
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
              </div>

              <div
                ref={timelineRef}
                className="relative h-[156px] overflow-x-auto overflow-y-hidden rounded-lg"
                style={{ background: "var(--surface-3)", border: "1px solid var(--card-border)" }}
                onMouseDown={(event) => {
                  if ((event.target as HTMLElement).closest("[data-clip]")) return;
                  scrubTimeline(event.clientX);
                }}
                onMouseMove={(event) => {
                  if (event.buttons === 1 && !(event.target as HTMLElement).closest("[data-clip]")) {
                    scrubTimeline(event.clientX);
                  }
                }}
              >
                <div className="relative h-full" style={{ width: timelineWidth }}>
                  <div className="absolute left-0 right-0 top-0 h-8 border-b border-white/10">
                    {rulerTicks.map((tick) => (
                      <div
                        key={tick.ms}
                        className="absolute top-0 h-full border-l border-white/15"
                        style={{ left: tick.left }}
                      >
                        {tick.major && (
                          <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                            {formatTimestamp(tick.ms).slice(0, 4)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="absolute inset-x-3 top-11 bottom-4">
                    {clips.length === 0 && (
                      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-white/20 text-sm text-muted-foreground">
                        Add media from the bin to build a cut.
                      </div>
                    )}
                    {clipSpans.map(({ clip, startMs }) => {
                      const width = Math.max(46, (clip.durationMs / 1000) * pxPerSecond);
                      const left = (startMs / 1000) * pxPerSecond;
                      const selected = clip.id === selectedClipId;
                      return (
                        <div
                          key={clip.id}
                          data-clip
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedClipId(clip.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") setSelectedClipId(clip.id);
                          }}
                          className="absolute top-0 bottom-0 overflow-hidden rounded-md text-left shadow-sm outline-none transition"
                          style={{
                            left,
                            width,
                            background: clip.kind === "panel" ? "rgba(157,208,255,0.42)" : "rgba(255,190,130,0.42)",
                            border: `2px solid ${selected ? "#9DD0FF" : "rgba(255,255,255,0.35)"}`,
                            boxShadow: selected ? "0 0 0 3px rgba(157,208,255,0.28)" : "0 2px 8px rgba(0,0,0,0.12)",
                          }}
                          title={`${clip.label} · ${formatTimestamp(clip.durationMs)}`}
                        >
                          {clip.kind === "panel" && (
                            <img src={clip.src} alt={clip.label} className="absolute inset-0 h-full w-full object-cover opacity-85" />
                          )}
                          <div className="absolute inset-x-0 bottom-0 z-10 bg-black/55 px-2 py-1">
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-white">
                              {clip.kind === "panel" ? <ImageIcon size={12} /> : <Film size={12} />}
                              <span className="truncate">{clip.label}</span>
                            </div>
                            <div className="font-mono text-[10px] text-white/70">{formatTimestamp(clip.durationMs)}</div>
                          </div>
                          <button
                            type="button"
                            data-clip
                            aria-label={`Resize ${clip.label}`}
                            className="absolute right-0 top-0 z-20 h-full w-3 cursor-ew-resize border-l border-white/30 bg-white/20 hover:bg-white/35"
                            onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setSelectedClipId(clip.id);
                              setResizeState({
                                clipId: clip.id,
                                startX: event.clientX,
                                originalDurationMs: clip.durationMs,
                                originalClips: clips,
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div
                    className="pointer-events-none absolute bottom-0 top-0 z-30"
                    style={{
                      left: 12 + (playheadMs / 1000) * pxPerSecond,
                      width: 2,
                      background: "#9DD0FF",
                      boxShadow: "0 0 10px rgba(157,208,255,0.8)",
                    }}
                  >
                    <div className="absolute -left-[5px] top-7 h-3 w-3 rotate-45 bg-[#9DD0FF]" />
                  </div>
                </div>
              </div>
          </ToolSurface>

          <ToolSurface className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                <h2 className="text-sm font-semibold">Clip Inspector</h2>
              </div>
              {!selectedClip && (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" style={{ borderColor: "var(--card-border)" }}>
                  Select a clip to rename, trim, split, duplicate, resize, or reorder it.
                </div>
              )}
              {selectedClip && (
                <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <label className="text-xs font-medium text-muted-foreground">
                      Name
                      <input
                        value={selectedClip.label}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => updateClip(selectedClip.id, { label: event.target.value })}
                        className="mt-1 w-full px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-medium text-muted-foreground">
                      Duration
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min={0.1}
                          step={0.1}
                          value={Number((selectedClip.durationMs / 1000).toFixed(2))}
                          onChange={(event) => updateClip(selectedClip.id, { durationMs: Number(event.target.value) * 1000 })}
                          className="w-full px-3 py-2 text-sm"
                        />
                        <span>s</span>
                      </div>
                    </label>
                    {selectedClip.kind === "animatic" && (
                      <label className="text-xs font-medium text-muted-foreground">
                        Trim start
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={selectedClip.sourceDurationMs ? Math.max(0, selectedClip.sourceDurationMs - selectedClip.durationMs) / 1000 : undefined}
                            step={0.1}
                            value={Number(((selectedClip.trimStartMs ?? 0) / 1000).toFixed(2))}
                            onChange={(event) => updateClip(selectedClip.id, { trimStartMs: Math.max(0, Number(event.target.value) * 1000) })}
                            className="w-full px-3 py-2 text-sm"
                          />
                          <span>s</span>
                        </div>
                      </label>
                    )}
                    <div className="flex items-end gap-2">
                      <button type="button" className="btn-ghost" onClick={() => updateClip(selectedClip.id, { durationMs: selectedClip.durationMs - 500 })}>-0.5s</button>
                      <button type="button" className="btn-ghost" onClick={() => updateClip(selectedClip.id, { durationMs: selectedClip.durationMs + 500 })}>+0.5s</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end justify-start gap-2 2xl:justify-end">
                    <button type="button" className="btn-ghost inline-flex items-center gap-2" disabled={!canSplitSelected} onClick={splitSelected}>
                      <Scissors size={14} />
                      Split
                    </button>
                    <button type="button" className="btn-ghost inline-flex items-center gap-2" onClick={duplicateSelected}>
                      <Copy size={14} />
                      Duplicate
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => moveSelected(-1)}>Move left</button>
                    <button type="button" className="btn-ghost" onClick={() => moveSelected(1)}>Move right</button>
                    <button type="button" className="btn-ghost inline-flex items-center gap-2 text-red-500" onClick={() => removeClip(selectedClip.id)}>
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </div>
              )}
          </ToolSurface>
        </>
      }
      aside={
        <ToolSurface className="h-fit max-h-[calc(100vh-2rem)] overflow-y-auto p-4 xl:sticky xl:top-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Media bin</div>
                <div className="text-sm font-medium">Project sources</div>
              </div>
              <button
                type="button"
                className="btn-ghost inline-flex items-center gap-2"
                disabled={allPanels.length === 0}
                onClick={() => addPanels(allPanels, "Panel")}
              >
                <ListPlus size={14} />
                Add all
              </button>
            </div>

            <div className="space-y-4">
              <section>
                <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <ImageIcon size={14} />
                  Storyboards
                  <span className="chip ml-auto">{allPanels.length}</span>
                </div>
                {storyboards.length === 0 && (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground" style={{ borderColor: "var(--card-border)" }}>
                    No storyboards yet.
                  </div>
                )}
                <div className="space-y-3">
                  {storyboards.map((storyboard) => {
                    const panels = (storyboard.panels ?? []).sort((a, b) => a.orderIdx - b.orderIdx);
                    return (
                      <div key={storyboard.id} className="panel-soft p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="min-w-0 flex-1 truncate text-sm font-medium">{storyboard.title}</div>
                          <button
                            type="button"
                            className="btn-ghost inline-flex items-center gap-1 px-2 py-1 text-xs"
                            disabled={panels.length === 0}
                            onClick={() => addPanels(panels, storyboard.title)}
                          >
                            <Plus size={12} />
                            Add
                          </button>
                        </div>
                        {panels.length === 0 && <div className="text-xs text-muted-foreground">No panels in this storyboard.</div>}
                        <div className="grid grid-cols-2 gap-2">
                          {panels.map((panel) => (
                            <button
                              key={panel.id}
                              type="button"
                              onClick={() => addPanelClip(panel)}
                              className="group relative aspect-video overflow-hidden rounded-md border transition hover:ring-2 hover:ring-sky-300"
                              style={{ borderColor: "var(--card-border)" }}
                              title={panel.caption || `Panel ${panel.orderIdx + 1}`}
                            >
                              <img
                                src={panel.imageData}
                                alt={panel.caption || panel.dialogue || `Storyboard panel ${panel.orderIdx + 1}`}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                <Plus size={18} className="text-white" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <hr className="hr-soft" />

              <section>
                <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <Film size={14} />
                  Animatics
                  <span className="chip ml-auto">{animatics.length}</span>
                </div>
                {animatics.length === 0 && (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground" style={{ borderColor: "var(--card-border)" }}>
                    No uploaded animatics yet.
                  </div>
                )}
                <div className="space-y-2">
                  {animatics.map((animatic) => {
                    const drawable = isCanvasDrawableVideoSource(animatic.videoData);
                    return (
                      <button
                        key={animatic.id}
                        type="button"
                        onClick={() => addAnimaticClip(animatic)}
                        className="w-full rounded-md border px-3 py-2 text-left transition hover:bg-white/40 dark:hover:bg-white/10"
                        style={{ borderColor: "var(--card-border)" }}
                      >
                        <div className="flex items-center gap-2">
                          <Film size={14} className="text-amber-500" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{animatic.title}</span>
                          <Plus size={14} className="opacity-60" />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{videoDurations[animatic.id] ? formatTimestamp(videoDurations[animatic.id]) : "4s default"}</span>
                          <span>•</span>
                          <span>{drawable ? "canvas-ready" : "external link"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
        </ToolSurface>
      }
    />
  );
}
