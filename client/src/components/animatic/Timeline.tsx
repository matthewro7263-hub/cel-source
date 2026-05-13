/**
 * Multi-track timeline component for the animatic editor.
 */
import { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import { Volume2, VolumeX, ChevronDown, Activity, MapPin } from "lucide-react";
import type { AnimaticTrackData, AnimaticClipData } from "./types";
import { getTrackColor, formatTime } from "./types";
import { detectBeats, detectLipSync } from "./aud_audio_utils";
import { getAudioContext } from "@/lib/aud_web_audio";

const TRACK_HEIGHT = 72;
const HEADER_WIDTH = 140;
const RULER_HEIGHT = 28;
const SNAP_MS = 200;
const MIN_CLIP_MS = 100;

interface TimelineProps {
  tracks: AnimaticTrackData[];
  totalDurationMs: number;
  currentMs: number;
  pxPerSec: number;
  onSeek: (ms: number) => void;
  onTrackMuteToggle: (trackId: number, muted: boolean) => void;
  onClipMove: (clipId: number, newStartMs: number) => void;
  onClipResize: (clipId: number, newDurationMs: number) => void;
  onClipDelete: (clipId: number) => void;
  onClipSettings: (clip: AnimaticClipData) => void;
  onAddPanelClip: (trackId: number, atMs: number) => void;
  onAddAudioClip: (trackId: number, atMs: number) => void;
  panelTrackId?: number;
}

export function Timeline({
  tracks,
  totalDurationMs,
  currentMs,
  pxPerSec,
  onSeek,
  onTrackMuteToggle,
  onClipMove,
  onClipResize,
  onClipDelete,
  onClipSettings,
  onAddPanelClip,
  onAddAudioClip,
  panelTrackId,
}: TimelineProps) {
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const clipsScrollRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clip: AnimaticClipData } | null>(null);
  const [markers, setMarkers] = useState<{ ms: number; label: string }[]>([]);
  const [isDetectingBeats, setIsDetectingBeats] = useState(false);
  const [draggingMarker, setDraggingMarker] = useState<number | null>(null);
  const [markerLabelEdit, setMarkerLabelEdit] = useState<{ index: number; text: string } | null>(null);
  
  const [dragging, setDragging] = useState<{
    clipId: number;
    originalStartMs: number;
    dragStartX: number;
    type: "move" | "resize";
  } | null>(null);

  const msToPx = useCallback((ms: number) => (ms / 1000) * pxPerSec, [pxPerSec]);
  const pxToMs = useCallback((px: number) => (px / pxPerSec) * 1000, [pxPerSec]);

  const totalWidth = Math.max(msToPx(totalDurationMs) + 80, 600);

  // Sync playhead into view
  useEffect(() => {
    const el = clipsScrollRef.current;
    if (!el) return;
    const playheadX = msToPx(currentMs);
    if (playheadX < el.scrollLeft || playheadX > el.scrollLeft + el.clientWidth - 40) {
      el.scrollLeft = Math.max(0, playheadX - el.clientWidth / 2);
    }
  }, [currentMs, msToPx]);

  // Generate ruler tick marks
  const rulerTicks: JSX.Element[] = [];
  const secInterval = pxPerSec >= 120 ? 0.5 : pxPerSec >= 60 ? 1 : pxPerSec >= 30 ? 2 : 5;
  const totalSecs = totalDurationMs / 1000 + 2;
  for (let s = 0; s <= totalSecs; s += secInterval) {
    const x = msToPx(s * 1000);
    const isMajor = Number.isInteger(s);
    rulerTicks.push(
      <g key={s} transform={`translate(${x},0)`}>
        <line y1={isMajor ? 0 : RULER_HEIGHT / 2} y2={RULER_HEIGHT} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        {isMajor && (
          <text y={14} fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="ui-monospace, monospace">
            {formatTime(s * 1000).slice(0, 5)}
          </text>
        )}
      </g>,
    );
  }

  const handleRulerClick = (e: React.MouseEvent<SVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek(Math.max(0, pxToMs(x)));
  };

  const handleTrackClick = (
    e: React.MouseEvent<HTMLDivElement>,
    track: AnimaticTrackData,
  ) => {
    // Only fire if clicking on empty area (not a clip)
    if ((e.target as HTMLElement).closest("[data-clip]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ms = Math.max(0, pxToMs(x));
    if (track.kind === "panel") {
      onAddPanelClip(track.id, ms);
    } else {
      onAddAudioClip(track.id, ms);
    }
  };

  const handleClipMouseDown = (
    e: React.MouseEvent,
    clip: AnimaticClipData,
    type: "move" | "resize",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging({ clipId: clip.id, originalStartMs: clip.startMs, dragStartX: e.clientX, type });
  };

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - dragging.dragStartX;
      const deltaMs = pxToMs(deltaPx);

      // Find clip
      let clip: AnimaticClipData | undefined;
      for (const t of tracks) {
        clip = t.clips.find((c) => c.id === dragging.clipId);
        if (clip) break;
      }
      if (!clip) return;

      if (dragging.type === "move") {
        let newStart = Math.max(0, dragging.originalStartMs + deltaMs);
        // Snap to playhead
        if (Math.abs(newStart - currentMs) < SNAP_MS) newStart = currentMs;
        onClipMove(dragging.clipId, Math.round(newStart));
      } else {
        // Resize right edge
        const newDuration = Math.max(MIN_CLIP_MS, clip.durationMs + deltaMs);
        onClipResize(dragging.clipId, Math.round(newDuration));
      }
    };
    const onMouseUp = () => setDragging(null);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, pxToMs, tracks, currentMs, onClipMove, onClipResize]);

  const handleContextMenu = (e: React.MouseEvent, clip: AnimaticClipData) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, clip });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  const handleDetectBeats = async () => {
    let targetClipUrl = null;
    let trackStart = 0;
    
    for (const t of tracks) {
      if (t.kind === "music" || t.kind === "sfx" || t.kind === "voice") {
        for (const c of t.clips) {
          if (c.sourceKind === "audio_data" && c.audioDataUrl) {
            targetClipUrl = c.audioDataUrl;
            trackStart = c.startMs;
            break;
          }
        }
      }
      if (targetClipUrl) break;
    }
    
    if (!targetClipUrl) return;
    
    setIsDetectingBeats(true);
    try {
      const peaks = await detectBeats(targetClipUrl);
      const newMarkers = peaks.map(ms => ({ ms: ms + trackStart, label: "Beat" }));
      setMarkers(prev => {
        const combined = [...prev];
        newMarkers.forEach(nm => {
          if (!combined.some(m => Math.abs(m.ms - nm.ms) < 50)) {
            combined.push(nm);
          }
        });
        return combined.sort((a,b) => a.ms - b.ms);
      });
    } catch(e) {
      console.error(e);
    } finally {
      setIsDetectingBeats(false);
    }
  };

  const [lipSyncData, setLipSyncData] = useState<Record<number, any[]>>({});

  const handleDetectLipSync = async (clip: AnimaticClipData) => {
    if (!clip.audioDataUrl) return;
    
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      let arrayBuffer;
      if (clip.audioDataUrl.startsWith('data:')) {
        const b64 = clip.audioDataUrl.split(',')[1];
        const binaryStr = atob(b64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
        arrayBuffer = bytes.buffer;
      } else {
        const res = await fetch(clip.audioDataUrl);
        arrayBuffer = await res.arrayBuffer();
      }
      
      const offlineCtx = new OfflineAudioContext(1, 1, 44100);
      const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
      
      const timeline = detectLipSync(audioBuffer, 0); // relative to clip start
      setLipSyncData(prev => ({ ...prev, [clip.id]: timeline }));
    } catch(e) {
      console.error("Lip sync failed:", e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/30 rounded-xl border border-white/10 overflow-hidden select-none relative">
      {/* Track header + ruler row */}
      <div className="flex shrink-0" style={{ height: RULER_HEIGHT }}>
        <div
          className="shrink-0 bg-white/5 border-r border-white/10 flex items-center justify-between px-2"
          style={{ width: HEADER_WIDTH }}
        >
          <span className="text-xs text-white/50">Timeline</span>
          <button 
            className="text-[10px] bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded flex items-center gap-1 text-white/80"
            onClick={handleDetectBeats}
            disabled={isDetectingBeats}
          >
            <Activity size={10} /> {isDetectingBeats ? "Wait..." : "Beats"}
          </button>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div
            className="overflow-hidden h-full relative"
            ref={rulerScrollRef}
            onScroll={(e) => {
              if (isSyncing.current) return;
              if (clipsScrollRef.current) {
                isSyncing.current = true;
                clipsScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
                requestAnimationFrame(() => isSyncing.current = false);
              }
            }}
            onMouseMove={e => {
              if (draggingMarker !== null && rulerScrollRef.current) {
                const rect = rulerScrollRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left + rulerScrollRef.current.scrollLeft;
                const newMs = Math.max(0, pxToMs(x));
                setMarkers(prev => prev.map((m, i) => i === draggingMarker ? { ...m, ms: newMs } : m));
              }
            }}
            onMouseUp={() => setDraggingMarker(null)}
            onMouseLeave={() => setDraggingMarker(null)}
            style={{ width: "100%", overflowX: "hidden" }}
          >
            <svg
              width={totalWidth}
              height={RULER_HEIGHT}
              style={{ display: "block", pointerEvents: "all" }}
              onClick={handleRulerClick}
              className="cursor-pointer"
            >
              <rect width={totalWidth} height={RULER_HEIGHT} fill="rgba(0,0,0,0.3)" />
              {rulerTicks}
            </svg>
            
            {/* Markers */}
            {markers.map((m, i) => (
              <div 
                key={i} 
                className="absolute top-0 flex flex-col items-center group cursor-ew-resize z-50 pointer-events-auto"
                style={{ left: msToPx(m.ms), height: "2000px" }}
                onMouseDown={(e) => { e.stopPropagation(); setDraggingMarker(i); }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setMarkerLabelEdit({ index: i, text: m.label });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMarkers(prev => prev.filter((_, idx) => idx !== i));
                }}
              >
                <MapPin size={12} className="text-yellow-400 mt-1 pointer-events-none" />
                <div className="w-px h-full bg-yellow-400/50 pointer-events-none" />
                {markerLabelEdit?.index === i ? (
                  <input 
                    autoFocus
                    className="absolute top-4 bg-black text-xs px-1 py-0.5 rounded border border-yellow-400 text-yellow-400 w-24 z-20"
                    value={markerLabelEdit.text}
                    onChange={e => setMarkerLabelEdit({ index: i, text: e.target.value })}
                    onBlur={() => {
                      setMarkers(prev => prev.map((m, idx) => idx === i ? { ...m, label: markerLabelEdit.text } : m));
                      setMarkerLabelEdit(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        setMarkers(prev => prev.map((m, idx) => idx === i ? { ...m, label: markerLabelEdit.text } : m));
                        setMarkerLabelEdit(null);
                      }
                    }}
                  />
                ) : (
                  <span className="absolute top-4 text-[9px] text-yellow-400 bg-black/50 px-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">
                    {m.label}
                  </span>
                )}
              </div>
            ))}
            
          </div>
        </div>
      </div>

      {/* Scrollable track area */}
      <div className="flex flex-1 min-h-0">
        {/* Track headers (fixed) */}
        <div
          className="shrink-0 border-r border-white/10 overflow-hidden"
          style={{ width: HEADER_WIDTH }}
        >
          {tracks.map((track) => {
            const color = getTrackColor(track.kind);
            return (
              <div
                key={track.id}
                className="flex items-center gap-2 px-2 border-b border-white/5"
                style={{
                  height: TRACK_HEIGHT,
                  background: color.bg,
                }}
              >
                <button
                  className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
                  onClick={() => onTrackMuteToggle(track.id, !track.muted)}
                  title={track.muted ? "Unmute" : "Mute"}
                >
                  {track.muted ? (
                    <VolumeX size={14} className="text-red-400" />
                  ) : (
                    <Volume2 size={14} style={{ color: color.text }} />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-semibold truncate"
                    style={{ color: color.text }}
                  >
                    {track.name}
                  </p>
                  <p className="text-[10px] text-white/30 truncate uppercase tracking-wider">
                    {track.kind}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable clip area */}
        <div
          ref={clipsScrollRef}
          onScroll={(e) => {
            if (isSyncing.current) return;
            if (rulerScrollRef.current) {
              isSyncing.current = true;
              rulerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
              requestAnimationFrame(() => isSyncing.current = false);
            }
          }}
          className="flex-1 overflow-x-auto overflow-y-hidden relative"
        >
          <div style={{ width: totalWidth, position: "relative" }}>
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px z-20 pointer-events-none"
              style={{
                left: msToPx(currentMs),
                background: "rgba(255, 60, 60, 0.9)",
                boxShadow: "0 0 6px rgba(255,60,60,0.5)",
              }}
            />

            {/* Tracks */}
            {tracks.map((track) => {
              const color = getTrackColor(track.kind);
              return (
                <div
                  key={track.id}
                  className="border-b border-white/5 relative cursor-pointer"
                  style={{ height: TRACK_HEIGHT, background: color.bg + "40" }}
                  onClick={(e) => handleTrackClick(e, track)}
                >
                  {track.clips.map((clip) => {
                    const left = msToPx(clip.startMs);
                    const width = Math.max(msToPx(clip.durationMs), 8);
                    return (
                      <div
                        key={clip.id}
                        data-clip="true"
                        className="absolute top-2 bottom-2 rounded-md overflow-hidden flex flex-col group"
                        style={{
                          left,
                          width,
                          background: color.clipBg,
                          border: `1px solid ${color.border}`,
                          cursor: dragging?.clipId === clip.id ? "grabbing" : "grab",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                        }}
                        onMouseDown={(e) => handleClipMouseDown(e, clip, "move")}
                        onContextMenu={(e) => handleContextMenu(e, clip)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (track.kind === "voice") {
                            handleDetectLipSync(clip);
                          }
                        }}
                      >
                        {/* Clip label */}
                        <div className="flex-1 flex items-center px-2 min-h-0 pointer-events-none w-full">
                          <span
                            className="text-[11px] text-white/90 font-medium truncate"
                            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
                          >
                            {clip.label || `${clip.sourceKind === "panel_ref" ? "Panel" : "Audio"}`}
                          </span>
                        </div>
                        
                        {/* Lip Sync Strip */}
                        {lipSyncData[clip.id] && (
                          <div className="flex-none h-4 bg-black/40 flex w-full pointer-events-none relative overflow-hidden">
                            {lipSyncData[clip.id].map((point, i) => (
                              <div 
                                key={i} 
                                className="absolute top-0 bottom-0 text-[8px] flex items-center justify-center border-r border-white/10"
                                style={{ 
                                  left: msToPx(point.timeMs),
                                  width: msToPx(50) // Assuming 50ms steps from aud_audio_utils
                                }}
                              >
                                {point.shape !== "rest" ? point.shape : ""}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Resize handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 transition-colors"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDragging({
                              clipId: clip.id,
                              originalStartMs: clip.startMs,
                              dragStartX: e.clientX,
                              type: "resize",
                            });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-popover/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors"
            onClick={() => {
              onClipSettings(contextMenu.clip);
              setContextMenu(null);
            }}
          >
            Settings (volume, fade)
          </button>
          <div className="my-1 border-t border-white/10" />
          <button
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            onClick={() => {
              onClipDelete(contextMenu.clip.id);
              setContextMenu(null);
            }}
          >
            Delete clip
          </button>
        </div>
      )}
    </div>
  );
}
