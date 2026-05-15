import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Columns2, Eye, Pause, Play } from "lucide-react";
import { ToolSurface, ToolWorkspace } from "@/components/layout/tool-workspace";
import {
  flattenComparableMedia,
  isVideoSource,
  type CompareAnimatic,
  type CompareMediaItem,
  type CompareStoryboard,
} from "./compare-model";

function MediaPane({
  item,
  videoRef,
}: {
  item?: CompareMediaItem;
  videoRef: RefObject<HTMLVideoElement>;
}) {
  if (!item) {
    return (
      <div className="grid aspect-video place-items-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
        No media selected
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border bg-black">
      {isVideoSource(item.src) ? (
        <video ref={videoRef} src={item.src} className="aspect-video w-full object-contain" muted playsInline />
      ) : (
        <img src={item.src} alt={item.label} className="aspect-video w-full object-contain" draggable={false} />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 text-white">
        <div className="text-xs uppercase tracking-wider text-white/55">{item.kind}</div>
        <div className="font-medium">{item.label}</div>
        {item.caption && <div className="mt-0.5 line-clamp-1 text-xs text-white/65">{item.caption}</div>}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const params = useParams() as { id: string };
  const projectId = parseInt(params.id, 10);
  const [, setLocation] = useLocation();
  const leftVideoRef = useRef<HTMLVideoElement>(null);
  const rightVideoRef = useRef<HTMLVideoElement>(null);

  const [leftKey, setLeftKey] = useState("");
  const [rightKey, setRightKey] = useState("");
  const [playing, setPlaying] = useState(false);
  const [scrubPct, setScrubPct] = useState(0);
  const [diffEnabled, setDiffEnabled] = useState(false);
  const [diffOpacity, setDiffOpacity] = useState(50);

  const { data: storyboards = [] } = useQuery<CompareStoryboard[]>({
    queryKey: [`/api/projects/${projectId}/storyboards`],
    enabled: !!projectId,
  });

  const { data: animatics = [] } = useQuery<CompareAnimatic[]>({
    queryKey: [`/api/projects/${projectId}/animatics`],
    queryFn: async () => (await apiRequest("GET", `/api/projects/${projectId}/animatics`)).json(),
    enabled: !!projectId,
  });

  const media = useMemo(() => flattenComparableMedia(storyboards, animatics), [storyboards, animatics]);

  useEffect(() => {
    if (!media.length) return;
    if (!leftKey) setLeftKey(media[0].key);
    if (!rightKey) setRightKey(media[1]?.key || media[0].key);
  }, [media, leftKey, rightKey]);

  const leftItem = media.find((item) => item.key === leftKey);
  const rightItem = media.find((item) => item.key === rightKey);
  const canDiffImages = !!leftItem && !!rightItem && !isVideoSource(leftItem.src) && !isVideoSource(rightItem.src);

  const syncVideosToPercent = (pct: number) => {
    [leftVideoRef.current, rightVideoRef.current].forEach((video) => {
      if (!video || Number.isNaN(video.duration) || video.duration === 0) return;
      video.currentTime = (pct / 100) * video.duration;
    });
  };

  const togglePlayback = async () => {
    const videos = [leftVideoRef.current, rightVideoRef.current].filter(Boolean) as HTMLVideoElement[];
    if (!videos.length) return;
    if (playing) {
      videos.forEach((video) => video.pause());
      setPlaying(false);
      return;
    }
    await Promise.all(videos.map((video) => video.play().catch(() => undefined)));
    setPlaying(true);
  };

  const handleScrub = (value: number) => {
    setScrubPct(value);
    syncVideosToPercent(value);
  };

  return (
    <ToolWorkspace
      backAction={
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/projects/${projectId}`)}>
          <ArrowLeft size={16} className="mr-1" /> Back to project
        </Button>
      }
      title="Version Compare"
      icon={<Columns2 className="h-5 w-5 text-primary" />}
      meta={
        <>
          <span>{media.length} source{media.length === 1 ? "" : "s"}</span>
          <span>•</span>
          <span>{diffEnabled && canDiffImages ? "Image diff mode" : "Synchronized playback"}</span>
        </>
      }
      actions={
        <Button variant="outline" size="sm" onClick={togglePlayback} disabled={!leftItem && !rightItem} data-testid="button-compare-play">
          {playing ? <Pause size={14} className="mr-1.5" /> : <Play size={14} className="mr-1.5" />}
          {playing ? "Pause synced media" : "Play synced media"}
        </Button>
      }
      main={
        <div className="space-y-4">
          <ToolSurface className="p-4">
            {diffEnabled && canDiffImages ? (
              <div className="relative overflow-hidden rounded-xl border bg-black">
                <img src={leftItem.src} alt={leftItem.label} className="aspect-video w-full object-contain" />
                <img
                  src={rightItem.src}
                  alt={rightItem.label}
                  className="absolute inset-0 h-full w-full object-contain mix-blend-difference"
                  style={{ opacity: diffOpacity / 100 }}
                />
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                <MediaPane item={leftItem} videoRef={leftVideoRef} />
                <MediaPane item={rightItem} videoRef={rightVideoRef} />
              </div>
            )}
          </ToolSurface>

          {media.length === 0 && (
            <ToolSurface>
              <div className="py-12 text-center text-sm text-muted-foreground">
                Add storyboard panels or animatics to compare revisions.
              </div>
            </ToolSurface>
          )}
        </div>
      }
      aside={
        <Card className="border-border/70 bg-background/84 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm">Compare setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Left source</span>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={leftKey} onChange={(event) => setLeftKey(event.target.value)} data-testid="select-compare-left">
                {media.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Right source</span>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={rightKey} onChange={(event) => setRightKey(event.target.value)} data-testid="select-compare-right">
                {media.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>

            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Shared scrubber</span>
                <span>{Math.round(scrubPct)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={scrubPct}
                onChange={(event) => handleScrub(Number(event.target.value))}
                onInput={(event) => handleScrub(Number((event.target as HTMLInputElement).value))}
                className="w-full"
                data-testid="range-compare-scrub"
              />
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2"><Eye size={14} /> Diff overlay</span>
                <input
                  type="checkbox"
                  checked={diffEnabled}
                  disabled={!canDiffImages}
                  onChange={(event) => setDiffEnabled(event.target.checked)}
                />
              </label>
              <input
                type="range"
                min="10"
                max="90"
                value={diffOpacity}
                disabled={!canDiffImages || !diffEnabled}
                onChange={(event) => setDiffOpacity(Number(event.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Diff overlay is available when both selected sources are storyboard images.
              </p>
            </div>
          </CardContent>
        </Card>
      }
    />
  );
}
