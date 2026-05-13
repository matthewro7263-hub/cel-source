import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GlassButton } from "@/components/ui/glass-button";

interface Cue {
  id: number;
  projectId: number;
  timestampMs: number;
  label: string;
  color: string;
}

export default function CueMarkers({ projectId }: { projectId: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [newLabel, setNewLabel] = useState("");
  const playheadInterval = useRef<NodeJS.Timeout | null>(null);

  const { data: cues = [] } = useQuery<Cue[]>({
    queryKey: [`/api/projects/${projectId}/cues`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/cues`);
      return res.json();
    }
  });

  const addCueMutation = useMutation({
    mutationFn: async (cue: Partial<Cue>) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/cues`, cue);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/cues`] });
    }
  });
  
  const deleteCueMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cues/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/cues`] });
    }
  });

  useEffect(() => {
    if (isPlaying) {
      playheadInterval.current = setInterval(() => {
        setPlayheadMs(prev => {
          if (prev >= 10000) { // arbitrary 10s max for now
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
  }, [isPlaying]);

  const handleAddMarker = () => {
    addCueMutation.mutate({
      timestampMs: playheadMs,
      label: newLabel || `Marker at ${playheadMs}ms`,
      color: "#9DD0FF"
    });
    setNewLabel("");
  };

  const msToPx = (ms: number) => (ms / 100) * 10; // 100ms = 10px
  const maxTimeMs = 10000;

  return (
    <div className="flex flex-col gap-4 p-4 border border-white/10 bg-black/40 rounded-lg backdrop-blur-sm mt-8">
      <h2 className="text-xl font-semibold">Audio-Reactive Cue Markers</h2>
      <div className="flex gap-2 items-center">
        <GlassButton onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? "Pause" : "Play"}
        </GlassButton>
        <span className="text-sm text-white/60 font-mono w-20">
          {(playheadMs / 1000).toFixed(2)}s
        </span>
        <input 
          type="text" 
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Marker label..."
          className="flex-1 bg-black/50 border border-white/20 rounded px-3 py-1.5 text-sm text-white max-w-xs"
        />
        <GlassButton onClick={handleAddMarker} disabled={addCueMutation.isPending}>
          Add Marker Here
        </GlassButton>
      </div>

      <div className="relative h-24 bg-black/60 border border-white/10 rounded overflow-x-auto mt-4">
        <div className="relative h-full" style={{ width: Math.max(800, msToPx(maxTimeMs)) + "px" }}>
          
          {/* Cues */}
          {cues.map(cue => (
            <div 
              key={cue.id}
              className="absolute top-0 bottom-0 flex flex-col items-center group"
              style={{ left: msToPx(cue.timestampMs) + "px", transform: "translateX(-50%)" }}
            >
              <div 
                className="bg-black border px-2 py-1 text-xs rounded shadow-lg whitespace-nowrap cursor-pointer hover:bg-white/10"
                style={{ borderColor: cue.color }}
                onClick={() => deleteCueMutation.mutate(cue.id)}
                title="Click to delete"
              >
                {cue.label}
              </div>
              <div className="flex-1 w-px border-l border-dashed" style={{ borderColor: cue.color }} />
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
  );
}
