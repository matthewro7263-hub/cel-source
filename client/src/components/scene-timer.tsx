// v4 Scene timer — stopwatch per scene
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Timer, Square, Play } from "lucide-react";

interface TimeEntry {
  id: number;
  sceneId: number;
  userId: number;
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
}

interface TimeData {
  entries: TimeEntry[];
  totalMs: number;
  active: TimeEntry | null;
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Inline timer button for scene rows
export function SceneTimerButton({ sceneId }: { sceneId: number }) {
  const { data } = useQuery<TimeData>({
    queryKey: ["/api/scenes", sceneId, "time"],
    queryFn: async () => (await apiRequest("GET", `/api/scenes/${sceneId}/time`)).json(),
    refetchInterval: (data) => data?.state?.data?.active ? 1000 : false,
  });

  const [elapsed, setElapsed] = useState(0);
  const active = data?.active;

  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const update = () => setElapsed(Date.now() - active.startedAt);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [active?.id]);

  const { toast } = useToast();

  const start = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/scenes/${sceneId}/timer/start`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/scenes", sceneId, "time"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const stop = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/scenes/${sceneId}/timer/stop`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/scenes", sceneId, "time"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isRunning = !!active;

  return (
    <div className="flex items-center gap-1">
      {isRunning && (
        <span className="font-mono text-xs text-primary tabular-nums" data-testid={`timer-display-${sceneId}`}>
          {formatMs(elapsed)}
        </span>
      )}
      <Button
        size="icon"
        variant="ghost"
        className={`h-6 w-6 ${isRunning ? "text-red-500 hover:text-red-600" : "text-muted-foreground"}`}
        onClick={() => isRunning ? stop.mutate() : start.mutate()}
        disabled={start.isPending || stop.isPending}
        title={isRunning ? "Stop timer" : "Start timer"}
        data-testid={`button-timer-${sceneId}`}
      >
        {isRunning ? <Square size={11} className="fill-current" /> : <Timer size={11} />}
      </Button>
    </div>
  );
}

// Full time breakdown for scene detail
export function SceneTimeBreakdown({ sceneId }: { sceneId: number }) {
  const { data } = useQuery<TimeData>({
    queryKey: ["/api/scenes", sceneId, "time"],
    queryFn: async () => (await apiRequest("GET", `/api/scenes/${sceneId}/time`)).json(),
  });

  if (!data || data.entries.length === 0) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Timer size={12} /> No time tracked yet
      </div>
    );
  }

  const completed = data.entries.filter((e) => e.durationMs != null);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Timer size={14} />
        Total: <span className="font-mono">{formatMs(data.totalMs)}</span>
      </div>
      <div className="space-y-1">
        {completed.map((e) => (
          <div key={e.id} className="text-xs text-muted-foreground flex gap-2">
            <span className="font-mono">{formatMs(e.durationMs!)}</span>
            <span>{new Date(e.startedAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
