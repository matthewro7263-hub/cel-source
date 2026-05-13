import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Brush, Eraser, Radio, FileDown, CheckCircle2 } from "lucide-react";
import { getAuthToken, apiRequest, queryClient } from "@/lib/queryClient";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";
import type { Panel, Storyboard } from "@shared/schema";

interface StoryboardWithPanels extends Storyboard {
  panels?: Panel[];
}

interface ReviewPanel extends Panel {
  label: string;
}

interface CursorState {
  x: number;
  y: number;
  userId: number;
}

function drawSegment(canvas: HTMLCanvasElement, from: { x: number; y: number }, to: { x: number; y: number }, color: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
  ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
  ctx.stroke();
}

// This page currently has no Radix Select controls; keep any future empty options on non-empty sentinels.
export default function ReviewRoomPage() {
  const params = useParams() as { id: string };
  const projectId = parseInt(params.id, 10);
  const [, setLocation] = useLocation();
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState(1);
  const [currentPanel, setCurrentPanel] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [color, setColor] = useState("#9DD0FF");
  const [cursors, setCursors] = useState<Record<number, CursorState>>({});
  const [events, setEvents] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: storyboards = [] } = useQuery<StoryboardWithPanels[]>({
    queryKey: [`/api/projects/${projectId}/storyboards`],
    enabled: !!projectId,
  });

  const panels = useMemo<ReviewPanel[]>(() => {
    return storyboards.flatMap((storyboard) =>
      [...(storyboard.panels || [])]
        .sort((a, b) => a.orderIdx - b.orderIdx)
        .map((panel, index) => ({ ...panel, label: `${storyboard.title} - Panel ${index + 1}` })),
    );
  }, [storyboards]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !projectId) return;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/api/projects/${projectId}/review-room?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "presence") setPresence(message.count || 1);
      if (message.type === "cursor") {
        setCursors((prev) => ({ ...prev, [message.userId]: { x: message.x, y: message.y, userId: message.userId } }));
      }
      if (message.type === "stroke" && canvasRef.current) {
        drawSegment(canvasRef.current, message.from, message.to, message.color || "#9DD0FF");
      }
      if (message.type === "clear" && canvasRef.current) {
        canvasRef.current.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setEvents((prev) => ["Telestrator cleared", ...prev].slice(0, 6));
      }
      if (message.type === "playhead") setPlayhead(message.value || 0);
      if (message.type === "panel") setCurrentPanel(message.value || 0);
      if (message.type === "note") setEvents((prev) => [message.body, ...prev].slice(0, 6));
    };

    return () => ws.close();
  }, [projectId]);

  const send = (payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(payload));
  };

  const relativePoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    lastPointRef.current = relativePoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = relativePoint(event);
    send({ type: "cursor", ...point });
    if (!lastPointRef.current || !canvasRef.current) return;
    const from = lastPointRef.current;
    drawSegment(canvasRef.current, from, point, color);
    send({ type: "stroke", from, to: point, color });
    lastPointRef.current = point;
  };

  const stopDrawing = () => {
    lastPointRef.current = null;
  };

  const selectPanel = (value: number) => {
    setCurrentPanel(value);
    send({ type: "panel", value });
  };

  const updatePlayhead = (value: number) => {
    setPlayhead(value);
    send({ type: "playhead", value });
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    send({ type: "clear" });
  };

  const exportPDF = () => {
    const doc = new jsPDF("landscape");
    doc.setFontSize(18);
    doc.text(`Review Session: Project ${projectId}`, 10, 20);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 10, 28);

    panels.forEach((p, i) => {
      if (i > 0) doc.addPage("landscape");
      doc.text(p.label, 10, 10);
      try {
        doc.addImage(p.imageData, "JPEG", 10, 15, 277, 155);
      } catch (e) {
        doc.text("Image load failed", 10, 20);
      }
    });

    doc.save(`review-project-${projectId}.pdf`);
    toast({ title: "PDF Exported", description: "Your review session notes have been saved." });
  };

  const flipStatus = async () => {
    if (!panel) return;
    try {
      // In a real app, we'd find the linked scene/shot. 
      // For this implementation, we'll mark the panel as 'approved' via comment
      await apiRequest("POST", `/api/projects/${projectId}/comments`, {
        body: `✅ APPROVED in Review Room: ${panel.label}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/comments`] });
      toast({ title: "Status Updated", description: "Marked as approved in project logs." });
      send({ type: "note", body: `✅ ${panel.label} approved by reviewer` });
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const panel = panels[currentPanel];

  return (
    <div className="px-5 py-7 sm:px-6 lg:px-10 lg:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation(`/projects/${projectId}`)}>
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Radio className={connected ? "h-5 w-5 text-emerald-500" : "h-5 w-5 text-muted-foreground"} />
            <h1 className="font-display text-xl font-bold">Review Room</h1>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">{connected ? `${presence} reviewer${presence === 1 ? "" : "s"} connected` : "Connecting..."}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <FileDown size={16} className="mr-1.5" /> Export PDF
          </Button>
          <Button variant="default" size="sm" onClick={flipStatus} disabled={!panel} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 size={16} className="mr-1.5" /> Approve Panel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="relative aspect-video overflow-hidden rounded-xl border bg-black">
          {panel ? (
            <img src={panel.imageData} alt={panel.label} className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-sm text-white/45">No panels available for review.</div>
          )}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
          />
          {Object.values(cursors).map((cursor) => (
            <div
              key={cursor.userId}
              className="pointer-events-none absolute rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow"
              style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, transform: "translate(-50%, -50%)" }}
            >
              #{cursor.userId}
            </div>
          ))}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 text-white">
            <div className="text-xs uppercase tracking-wider text-white/50">Dailies panel</div>
            <div className="font-medium">{panel?.label || "Waiting for boards"}</div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Brush size={14} /> Telestrator
            </div>
            <div className="mb-3 flex gap-2">
              {["#9DD0FF", "#E8C44F", "#4FE89A", "#FF9999"].map((swatch) => (
                <button
                  key={swatch}
                  className={`h-8 w-8 rounded-full border-2 ${color === swatch ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: swatch }}
                  onClick={() => setColor(swatch)}
                  aria-label={`Use ${swatch}`}
                />
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={clearCanvas}>
              <Eraser size={14} className="mr-1.5" /> Clear shared drawing
            </Button>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 text-sm font-semibold">Shared playhead</div>
            <input
              type="range"
              min="0"
              max="100"
              value={playhead}
              onChange={(event) => updatePlayhead(Number(event.target.value))}
              onInput={(event) => updatePlayhead(Number((event.target as HTMLInputElement).value))}
              className="w-full"
              data-testid="range-review-playhead"
            />
            <div className="mt-1 text-xs text-muted-foreground">{Math.round(playhead)}%</div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 text-sm font-semibold">Panel queue</div>
            <select
              value={currentPanel}
              onChange={(event) => selectPanel(Number(event.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              data-testid="select-review-panel"
            >
              {panels.map((item, index) => <option key={item.id} value={index}>{item.label}</option>)}
            </select>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 text-sm font-semibold">Room log</div>
            <div className="space-y-2 text-xs text-muted-foreground">
              {events.length === 0 ? <div>No room events yet.</div> : events.map((event, index) => <div key={index}>{event}</div>)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
