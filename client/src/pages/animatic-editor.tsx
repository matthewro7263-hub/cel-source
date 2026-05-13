/**
 * Animatic Editor — Multi-track timeline editor for animatics.
 * Route: /projects/:projectId/animatic/:animaticId
 */
import {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Play, Pause, SkipBack, SkipForward, ChevronsLeft, ChevronsRight,
  Download, X, ZoomIn, ZoomOut, Check, Loader2, Film,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { GlassButton } from "@/components/ui/glass-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { AnimaticProjectFull, AnimaticClipData, AnimaticTrackData } from "@/components/animatic/types";
import { formatTime } from "@/components/animatic/types";
import { Timeline } from "@/components/animatic/Timeline";
import { PanelPickerDialog } from "@/components/animatic/PanelPickerDialog";
import { AudioDialog } from "@/components/animatic/AudioDialog";
import { ClipSettingsDialog } from "@/components/animatic/ClipSettingsDialog";
import { PlaybackEngine } from "@/components/animatic/playback-engine";
import { exportAnimaticToWebM, downloadBlob } from "@/lib/animatic-export";
import { CaptionsPanel } from "@/components/animatic/CaptionsPanel";
import { AmbientBedModal } from "@/components/animatic/AmbientBedModal";
import type { Panel } from "@shared/schema";

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 select-none">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center">
          <Film size={36} className="text-primary/60" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
          <span className="text-green-400 text-xs font-bold">+</span>
        </div>
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-base mb-1">No clips yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Drag your storyboard panels onto the <strong>Panels</strong> track, or click the track to pick panels from your storyboard.
        </p>
      </div>
    </div>
  );
}

// ── Export Dialog ─────────────────────────────────────────────────────────────
interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  progress: number;
  status: string;
  onCancel: () => void;
}
function ExportDialog({ open, onClose, progress, status, onCancel }: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && progress >= 100 && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Exporting Animatic</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">{status}</p>
          {progress < 100 && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            </div>
          )}
          {progress >= 100 && (
            <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-medium">
              <Check size={16} />
              Export complete — check your downloads
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center px-4">
          Output: WebM format (open with VLC, ffmpeg, or any modern browser).
          Export runs in real-time — actual rendering takes as long as the animatic duration.
        </p>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Editor ───────────────────────────────────────────────────────────────
export default function AnimaticEditor() {
  const params = useParams() as { projectId: string; animaticId: string };
  const projectId = parseInt(params.projectId, 10);
  const animaticId = parseInt(params.animaticId, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: animatic, isLoading } = useQuery<AnimaticProjectFull>({
    queryKey: ["/api/animatics-v2", animaticId],
    queryFn: async () => (await apiRequest("GET", `/api/animatics-v2/${animaticId}`)).json(),
  });

  // Local state for optimistic UI
  const [localTracks, setLocalTracks] = useState<AnimaticTrackData[]>([]);
  const [localTitle, setLocalTitle] = useState("");
  const [localFps, setLocalFps] = useState(24);
  const [localDurationMs, setLocalDurationMs] = useState(8000);
  const [editingTitle, setEditingTitle] = useState(false);

  useEffect(() => {
    if (animatic) {
      setLocalTracks(animatic.tracks as AnimaticTrackData[]);
      setLocalTitle(animatic.title);
      setLocalFps(animatic.fps);
      setLocalDurationMs(animatic.totalDurationMs);
    }
  }, [animatic]);

  // ── Resolve panel images ──────────────────────────────────────────────────
  // For panel_ref clips, we need the panel's imageData from storyboard API.
  // We cache them in a ref.
  const panelImageCache = useRef<Map<number, string>>(new Map());

  const { data: storyboards } = useQuery<{ id: number; title: string; panels: Panel[] }[]>({
    queryKey: ["/api/projects", projectId, "storyboards"],
    queryFn: async () =>
      (await apiRequest("GET", `/api/projects/${projectId}/storyboards`)).json(),
    enabled: !!animatic,
  });

  const panelImageUrl = useCallback(
    (panelId: number | null | undefined): string | undefined => {
      if (!panelId) return undefined;
      if (panelImageCache.current.has(panelId)) return panelImageCache.current.get(panelId);
      const allPanels = storyboards?.flatMap((sb) => sb.panels) ?? [];
      const p = allPanels.find((p) => p.id === panelId);
      if (p?.imageData) {
        panelImageCache.current.set(panelId, p.imageData);
        return p.imageData;
      }
      return undefined;
    },
    [storyboards],
  );

  // Enrich tracks with resolved URLs
  const enrichedTracks = useMemo((): AnimaticTrackData[] => {
    return localTracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => ({
        ...c,
        resolvedImageUrl:
          c.sourceKind === "panel_ref" ? panelImageUrl(c.sourceId) : undefined,
        resolvedAudioUrl:
          c.sourceKind === "audio_data" || c.sourceKind === "asset_ref"
            ? c.audioDataUrl ?? undefined
            : undefined,
      })),
    }));
  }, [localTracks, panelImageUrl]);

  // ── Playback ──────────────────────────────────────────────────────────────
  const [currentMs, setCurrentMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [activePanelClipId, setActivePanelClipId] = useState<number | null>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);

  useEffect(() => {
    const engine = new PlaybackEngine(
      enrichedTracks,
      localDurationMs,
      (ms) => setCurrentMs(ms),
      (clipId) => setActivePanelClipId(clipId),
    );
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Only recreate on mount/unmount — update via updateTracks below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.updateTracks(enrichedTracks, localDurationMs);
  }, [enrichedTracks, localDurationMs]);

  useEffect(() => {
    engineRef.current?.setMasterVolume(masterVolume);
  }, [masterVolume]);

  const handlePlayPause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isPlaying) {
      engine.pause();
      setIsPlaying(false);
    } else {
      engine.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Keep isPlaying in sync
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isPlaying && !engine.isPlaying()) engine.play();
    if (!isPlaying && engine.isPlaying()) engine.pause();
  }, [isPlaying]);

  const handleSeek = useCallback((ms: number) => {
    engineRef.current?.seek(ms);
    setCurrentMs(ms);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input, textarea, [contenteditable]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handleSeek(Math.max(0, currentMs - 1000));
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleSeek(Math.min(localDurationMs, currentMs + 1000));
      } else if (e.code === "Home") {
        e.preventDefault();
        handleSeek(0);
      } else if (e.code === "End") {
        e.preventDefault();
        handleSeek(localDurationMs);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlePlayPause, handleSeek, currentMs, localDurationMs]);

  // ── Preview image ─────────────────────────────────────────────────────────
  const activePreviewUrl = useMemo(() => {
    if (!activePanelClipId) return null;
    const panelTrack = enrichedTracks.find((t) => t.kind === "panel");
    const clip = panelTrack?.clips.find((c) => c.id === activePanelClipId);
    return clip?.resolvedImageUrl ?? null;
  }, [activePanelClipId, enrichedTracks]);

  // ── Timeline zoom ─────────────────────────────────────────────────────────
  const [pxPerSec, setPxPerSec] = useState(80);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patchAnimatic = useMutation({
    mutationFn: async (patch: { title?: string; fps?: number; totalDurationMs?: number }) => {
      setSaveState("saving");
      const res = await apiRequest("PATCH", `/api/animatics-v2/${animaticId}`, patch);
      return res.json();
    },
    onSuccess: () => {
      setSaveState("saved");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveState("idle"), 2000);
      queryClient.invalidateQueries({ queryKey: ["/api/animatics-v2", animaticId] });
    },
    onError: () => setSaveState("idle"),
  });

  const patchTrack = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/tracks/${id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/animatics-v2", animaticId] });
    },
  });

  const createClip = useMutation({
    mutationFn: async ({ trackId, data }: { trackId: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("POST", `/api/tracks/${trackId}/clips`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/animatics-v2", animaticId] });
    },
    onError: (e: any) => toast({ title: "Failed to add clip", description: String(e.message || e), variant: "destructive" }),
  });

  const patchClip = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/clips/${id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/animatics-v2", animaticId] });
    },
  });

  const deleteClip = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/clips/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/animatics-v2", animaticId] });
    },
  });

  // Optimistic clip move
  const handleClipMove = useCallback((clipId: number, newStartMs: number) => {
    setLocalTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, startMs: newStartMs } : c,
        ),
      })),
    );
    patchClip.mutate({ id: clipId, patch: { startMs: newStartMs } });
  }, [patchClip]);

  const handleClipResize = useCallback((clipId: number, newDurationMs: number) => {
    setLocalTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, durationMs: newDurationMs } : c,
        ),
      })),
    );
    patchClip.mutate({ id: clipId, patch: { durationMs: newDurationMs } });
  }, [patchClip]);

  const handleTrackMuteToggle = useCallback((trackId: number, muted: boolean) => {
    setLocalTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, muted } : t)),
    );
    patchTrack.mutate({ id: trackId, patch: { muted } });
  }, [patchTrack]);

  const handleClipDelete = useCallback((clipId: number) => {
    setLocalTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      })),
    );
    deleteClip.mutate(clipId);
  }, [deleteClip]);

  // ── Panel picker ──────────────────────────────────────────────────────────
  const [panelPickerOpen, setPanelPickerOpen] = useState(false);
  const [panelPickerTarget, setPanelPickerTarget] = useState<{ trackId: number; atMs: number } | null>(null);

  const handleAddPanelClip = useCallback((trackId: number, atMs: number) => {
    setPanelPickerTarget({ trackId, atMs });
    setPanelPickerOpen(true);
  }, []);

  const handlePanelSelected = useCallback((panel: Panel) => {
    if (!panelPickerTarget) return;
    createClip.mutate({
      trackId: panelPickerTarget.trackId,
      data: {
        startMs: Math.round(panelPickerTarget.atMs),
        durationMs: 2000,
        sourceKind: "panel_ref",
        sourceId: panel.id,
        label: panel.caption || `Panel ${panel.id}`,
      },
    });
  }, [panelPickerTarget, createClip]);

  // ── Audio dialog ──────────────────────────────────────────────────────────
  const [audioDialogOpen, setAudioDialogOpen] = useState(false);
  const [audioDialogTarget, setAudioDialogTarget] = useState<{ trackId: number; atMs: number } | null>(null);
  
  const [ambientBedOpen, setAmbientBedOpen] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);

  const handleAddAudioClip = useCallback((trackId: number, atMs: number) => {
    setAudioDialogTarget({ trackId, atMs });
    setAudioDialogOpen(true);
  }, []);

  const handleAudioAdd = useCallback(
    (audioDataUrl: string | null, label: string, sourceKind: string, sourceId?: number | null) => {
      if (!audioDialogTarget) return;
      createClip.mutate({
        trackId: audioDialogTarget.trackId,
        data: {
          startMs: Math.round(audioDialogTarget.atMs),
          durationMs: 3000,
          sourceKind,
          sourceId: sourceId ?? null,
          audioDataUrl,
          label,
        },
      });
    },
    [audioDialogTarget, createClip],
  );

  // ── Clip settings ─────────────────────────────────────────────────────────
  const [clipSettingsTarget, setClipSettingsTarget] = useState<AnimaticClipData | null>(null);

  const handleClipSettings = useCallback((clip: AnimaticClipData) => {
    setClipSettingsTarget(clip);
  }, []);

  const handleClipSettingsSave = useCallback(
    (clipId: number, patch: { volume: string; fadeInMs: number; fadeOutMs: number }) => {
      setLocalTracks((prev) =>
        prev.map((t) => ({
          ...t,
          clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
        })),
      );
      patchClip.mutate({ id: clipId, patch });
    },
    [patchClip],
  );

  // ── Export ────────────────────────────────────────────────────────────────
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");
  const exportAbortRef = useRef<AbortController | null>(null);

  const handleExport = async () => {
    setExportProgress(0);
    setExportStatus("Preparing…");
    setExportDialogOpen(true);

    exportAbortRef.current = new AbortController();

    try {
      const blob = await exportAnimaticToWebM({
        title: localTitle,
        fps: localFps,
        totalDurationMs: localDurationMs,
        masterVolume,
        tracks: enrichedTracks.map((t) => ({
          id: t.id,
          kind: t.kind,
          muted: t.muted,
          volume: parseFloat(t.volume),
          clips: t.clips.map((c) => ({
            id: c.id,
            startMs: c.startMs,
            durationMs: c.durationMs,
            sourceKind: c.sourceKind,
            imageUrl: c.resolvedImageUrl,
            audioUrl: c.resolvedAudioUrl,
            label: c.label,
            fadeInMs: c.fadeInMs,
            fadeOutMs: c.fadeOutMs,
            volume: parseFloat(c.volume),
          })),
        })),
        onProgress: (pct, status) => {
          setExportProgress(pct);
          setExportStatus(status);
        },
        signal: exportAbortRef.current.signal,
      });
      downloadBlob(blob, `${localTitle || "animatic"}.webm`);
    } catch (e: any) {
      if (e.name === "AbortError") {
        setExportStatus("Export cancelled.");
        setExportProgress(0);
      } else {
        toast({ title: "Export failed", description: String(e.message || e), variant: "destructive" });
        setExportDialogOpen(false);
      }
    }
  };

  const handleExportCancel = () => {
    exportAbortRef.current?.abort();
  };

  // ── Auto-save title/fps/duration ──────────────────────────────────────────
  const titleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTitleChange = (v: string) => {
    setLocalTitle(v);
    if (titleDebounce.current) clearTimeout(titleDebounce.current);
    titleDebounce.current = setTimeout(() => {
      patchAnimatic.mutate({ title: v });
    }, 800);
  };

  const handleFpsChange = (v: string) => {
    const n = parseInt(v, 10);
    if (n > 0) {
      setLocalFps(n);
      patchAnimatic.mutate({ fps: n });
    }
  };

  // ── Check for empty state ─────────────────────────────────────────────────
  const hasAnyClip = enrichedTracks.some((t) => t.clips.length > 0);
  const panelTrackId = enrichedTracks.find((t) => t.kind === "panel")?.id;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!animatic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Animatic not found.</p>
        <Button onClick={() => navigate(`/projects/${projectId}`)}>Back to project</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden" data-testid="animatic-editor">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-black/20 backdrop-blur-xl shrink-0 flex-wrap">
        {/* Title */}
        {editingTitle ? (
          <Input
            autoFocus
            value={localTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
            className="max-w-[220px] h-7 text-sm font-semibold"
            data-testid="input-animatic-title"
          />
        ) : (
          <button
            className="font-semibold text-sm hover:text-primary transition-colors"
            onClick={() => setEditingTitle(true)}
            data-testid="button-animatic-title"
          >
            {localTitle || "Untitled Animatic"}
          </button>
        )}

        {/* FPS */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">FPS</span>
          <Select value={String(localFps)} onValueChange={handleFpsChange}>
            <SelectTrigger className="h-7 w-16 text-xs" data-testid="select-fps">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[12, 15, 24, 25, 30, 60].map((f) => (
                <SelectItem key={f} value={String(f)}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Duration display */}
        <span className="text-xs text-muted-foreground">
          Duration: {formatTime(localDurationMs)}
        </span>

        <div className="flex-1" />

        {/* Save indicator */}
        {saveState === "saving" && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" />Saving…
          </span>
        )}
        {saveState === "saved" && (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <Check size={12} />Saved
          </span>
        )}

        {/* Export */}
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={() => setShowCaptions(!showCaptions)}
        >
          Captions
        </GlassButton>
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={() => setAmbientBedOpen(true)}
        >
          Ambient Bed
        </GlassButton>
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={handleExport}
          data-testid="button-export"
        >
          <Download size={14} />
          Export WebM
        </GlassButton>

        {/* Close */}
        <button
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          onClick={() => navigate(`/projects/${projectId}`)}
          data-testid="button-close-editor"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-col flex-1 min-h-0 gap-0">
        {/* ── Preview + controls ── */}
        <div className="flex items-start gap-4 px-4 pt-3 pb-2 shrink-0 h-[340px]">
          {/* Preview window */}
          <div
            className="rounded-xl overflow-hidden bg-black border border-white/10 shrink-0"
            style={{ aspectRatio: "16/9", width: "min(420px, 45vw)", flexShrink: 0 }}
          >
            {activePreviewUrl ? (
              <img
                src={activePreviewUrl}
                alt="Current panel"
                className="w-full h-full object-contain"
                data-testid="img-preview"
              />
            ) : !hasAnyClip ? (
              <div className="w-full h-full flex items-center justify-center p-4">
                <EmptyState />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 text-xs">
                No panel at this time
              </div>
            )}
          </div>

          {/* Transport + volume */}
          <div className="flex flex-col gap-3 flex-1 min-w-0 pt-1">
            {/* Time readout */}
            <div className="font-mono text-lg font-bold tracking-wider" data-testid="text-time">
              {formatTime(currentMs)}
              <span className="text-xs text-muted-foreground font-normal ml-2">
                / {formatTime(localDurationMs)}
              </span>
            </div>

            {/* Transport controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <GlassButton variant="ghost" size="sm" onClick={() => handleSeek(0)} title="Jump to start (Home)">
                <ChevronsLeft size={16} />
              </GlassButton>
              <GlassButton variant="ghost" size="sm" onClick={() => handleSeek(Math.max(0, currentMs - 1000))} title="Back 1s (←)">
                <SkipBack size={16} />
              </GlassButton>
              <GlassButton
                variant="primary"
                size="sm"
                onClick={handlePlayPause}
                title="Play/Pause (Space)"
                data-testid="button-play-pause"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </GlassButton>
              <GlassButton variant="ghost" size="sm" onClick={() => handleSeek(Math.min(localDurationMs, currentMs + 1000))} title="Forward 1s (→)">
                <SkipForward size={16} />
              </GlassButton>
              <GlassButton variant="ghost" size="sm" onClick={() => handleSeek(localDurationMs)} title="Jump to end (End)">
                <ChevronsRight size={16} />
              </GlassButton>
            </div>

            {/* Master volume */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-14 shrink-0">Volume</span>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[masterVolume]}
                onValueChange={([v]) => setMasterVolume(v)}
                className="flex-1"
                data-testid="slider-volume"
              />
              <span className="text-xs text-muted-foreground w-8 text-right">
                {Math.round(masterVolume * 100)}%
              </span>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-14 shrink-0">Zoom</span>
              <button
                className="p-1 rounded hover:bg-white/10 transition-colors"
                onClick={() => setPxPerSec((p) => Math.max(20, p / 1.4))}
                title="Zoom out (-)"
              >
                <ZoomOut size={14} />
              </button>
              <button
                className="p-1 rounded hover:bg-white/10 transition-colors"
                onClick={() => setPxPerSec((p) => Math.min(400, p * 1.4))}
                title="Zoom in (+)"
              >
                <ZoomIn size={14} />
              </button>
              <span className="text-xs text-muted-foreground">{Math.round(pxPerSec)}px/s</span>
            </div>
          </div>
          
          {/* Captions Panel (Toggleable) */}
          {showCaptions && (
            <div className="w-[300px] h-full shrink-0">
              <CaptionsPanel animaticId={animaticId} />
            </div>
          )}
        </div>

        {/* ── Timeline ── */}
        <div className="flex-1 min-h-0 px-4 pb-4">
          <Timeline
            tracks={enrichedTracks}
            totalDurationMs={localDurationMs}
            currentMs={currentMs}
            pxPerSec={pxPerSec}
            onSeek={handleSeek}
            onTrackMuteToggle={handleTrackMuteToggle}
            onClipMove={handleClipMove}
            onClipResize={handleClipResize}
            onClipDelete={handleClipDelete}
            onClipSettings={handleClipSettings}
            onAddPanelClip={handleAddPanelClip}
            onAddAudioClip={handleAddAudioClip}
            panelTrackId={panelTrackId}
          />
        </div>
      </div>

      {/* ── Dialogs ── */}
      <AmbientBedModal
        open={ambientBedOpen}
        onClose={() => setAmbientBedOpen(false)}
        onAdd={(audioDataUrl, label) => {
          // Add to the first available SFX/Music track
          const targetTrack = enrichedTracks.find(t => t.kind === "music" || t.kind === "sfx");
          if (targetTrack) {
            handleAddAudioClip(targetTrack.id, currentMs);
            // This relies on the next tick adding it, which isn't ideal but works for this demo.
            // A better way would be to just fire createClip directly.
            createClip.mutate({
              trackId: targetTrack.id,
              data: {
                startMs: currentMs,
                durationMs: 5000,
                sourceKind: "audio_data",
                audioDataUrl,
                label
              }
            });
          } else {
            toast({ title: "No audio track available", variant: "destructive" });
          }
        }}
      />
      
      <PanelPickerDialog
        open={panelPickerOpen}
        onClose={() => setPanelPickerOpen(false)}
        projectId={projectId}
        onSelectPanel={handlePanelSelected}
      />

      <AudioDialog
        open={audioDialogOpen}
        onClose={() => setAudioDialogOpen(false)}
        projectId={projectId}
        onAdd={handleAudioAdd}
      />

      <ClipSettingsDialog
        clip={clipSettingsTarget}
        onClose={() => setClipSettingsTarget(null)}
        onSave={handleClipSettingsSave}
      />

      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        progress={exportProgress}
        status={exportStatus}
        onCancel={handleExportCancel}
      />
    </div>
  );
}
