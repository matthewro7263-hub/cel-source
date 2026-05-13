import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GlassButton } from "@/components/ui/glass-button";
import {
  buildBlenderVisemeJson,
  buildMohoSwitchDat,
  generateLipsyncTimeline,
  MOUTH_COLORS,
  type VisemeKeyframe,
} from "./lipsync-model";

function downloadTextFile(filename: string, contents: string, type = "text/plain") {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LipSyncStub({ projectId }: { projectId: number }) {
  const [transcript, setTranscript] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const playheadInterval = useRef<NodeJS.Timeout | null>(null);

  const { data: lipsyncData } = useQuery({
    queryKey: [`/api/projects/${projectId}/lipsync`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/lipsync`);
      return res.json();
    }
  });

  const generateMutation = useMutation({
    mutationFn: async (transcriptText: string) => {
      const timeline = generateLipsyncTimeline(transcriptText);
      const res = await apiRequest("POST", `/api/projects/${projectId}/lipsync`, {
        transcript: transcriptText,
        timelineJson: JSON.stringify(timeline)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/lipsync`] });
    }
  });

  const latestLipsync = lipsyncData?.[lipsyncData.length - 1];
  const timeline: VisemeKeyframe[] = latestLipsync ? JSON.parse(latestLipsync.timelineJson) : [];
  const maxTimeMs = timeline.length > 0 ? timeline[timeline.length - 1].endMs : 0;
  const currentViseme = timeline.find((item) => playheadMs >= item.startMs && playheadMs < item.endMs)?.viseme || "rest";

  useEffect(() => {
    if (isPlaying) {
      playheadInterval.current = setInterval(() => {
        setPlayheadMs(prev => {
          if (prev >= maxTimeMs) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 50;
        });
      }, 50);
    } else {
      if (playheadInterval.current) clearInterval(playheadInterval.current);
    }
    return () => {
      if (playheadInterval.current) clearInterval(playheadInterval.current);
    };
  }, [isPlaying, maxTimeMs]);

  const handleGenerate = () => {
    if (transcript.trim()) {
      generateMutation.mutate(transcript);
    }
  };

  const msToPx = (ms: number) => (ms / 100) * 10; // 100ms = 10px

  return (
    <div className="flex flex-col gap-4 p-4 border border-white/10 bg-black/40 rounded-lg backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Phoneme Lip-Sync Generator</h2>
          <p className="text-xs text-white/55 mt-1">
            Local heuristic visemes for Moho switch layers or Blender mouth-shape keyframes.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-white/45">Current mouth</div>
          <div className="font-bold" style={{ color: MOUTH_COLORS[currentViseme] }}>{currentViseme}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <textarea 
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste transcript here..."
          rows={3}
          className="flex-1 bg-black/50 border border-white/20 rounded px-3 py-2 text-sm text-white resize-none"
        />
        <GlassButton onClick={handleGenerate} disabled={generateMutation.isPending}>
          {generateMutation.isPending ? "Generating..." : "Generate Visemes"}
        </GlassButton>
      </div>

      {timeline.length > 0 && (
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-white/60">Timeline (Estimated)</span>
            <div className="flex gap-2">
              <GlassButton onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? "Pause" : "Play"}
              </GlassButton>
              <GlassButton onClick={() => downloadTextFile("cel-lipsync-moho.dat", buildMohoSwitchDat(timeline))}>
                Moho .dat
              </GlassButton>
              <GlassButton onClick={() => downloadTextFile("cel-lipsync-blender.json", buildBlenderVisemeJson(timeline), "application/json")}>
                Blender JSON
              </GlassButton>
            </div>
          </div>
          
          <div className="relative h-20 bg-black/60 border border-white/10 rounded overflow-x-auto">
            <div className="relative h-full" style={{ width: Math.max(800, msToPx(maxTimeMs)) + "px" }}>
              {timeline.map((item, i) => (
                <div 
                  key={i}
                  className="absolute top-2 bottom-2 border border-black/50 flex items-center justify-center text-[10px] text-black font-bold"
                  style={{
                    left: msToPx(item.startMs) + "px",
                    width: msToPx(item.endMs - item.startMs) + "px",
                    backgroundColor: MOUTH_COLORS[item.viseme] || MOUTH_COLORS["rest"]
                  }}
                  title={`${item.viseme} (${item.startMs}-${item.endMs}ms)`}
                >
                  {item.viseme}
                </div>
              ))}
              
              {/* Playhead */}
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                style={{ left: msToPx(playheadMs) + "px" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
