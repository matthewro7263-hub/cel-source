// v4 Storyboard Sketching — in-browser canvas panel editor (~580 lines)
import { useRef, useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Pen, Eraser, Square, Circle, Minus, PaintBucket,
  Undo2, Redo2, Trash2, Save, X,
} from "lucide-react";

type Tool = "pen" | "eraser" | "fill" | "line" | "rect" | "circle";

const COLORS = [
  "#000000", "#ffffff", "#e74c3c", "#e67e22", "#f1c40f",
  "#2ecc71", "#3498db", "#9b59b6", "#1abc9c", "#34495e",
  "#7f8c8d", "#ecf0f1",
];

interface SketchModalProps {
  storyboardId: number;
  projectId: number;
  onClose: () => void;
}

export function SketchModal({ storyboardId, projectId, onClose }: SketchModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null); // for live shape preview
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const { toast } = useToast();

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1280, 720);
    saveSnapshot();
  }, []);

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const snap = ctx.getImageData(0, 0, 1280, 720);
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIdx + 1).concat(snap);
      return newHistory.slice(-50); // keep last 50 states
    });
    setHistoryIdx((prev) => Math.min(prev + 1, 49));
  }, [historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const newIdx = historyIdx - 1;
    ctx.putImageData(history[newIdx], 0, 0);
    setHistoryIdx(newIdx);
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const newIdx = historyIdx + 1;
    ctx.putImageData(history[newIdx], 0, 0);
    setHistoryIdx(newIdx);
  }, [history, historyIdx]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1280, 720);
    saveSnapshot();
  }, [saveSnapshot]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const floodFill = (x: number, y: number, fillColor: string) => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.getImageData(0, 0, 1280, 720);
    const data = imageData.data;
    const targetIdx = (Math.floor(y) * 1280 + Math.floor(x)) * 4;
    const targetR = data[targetIdx], targetG = data[targetIdx + 1], targetB = data[targetIdx + 2], targetA = data[targetIdx + 3];

    // Parse fill color
    const tempCtx = document.createElement("canvas").getContext("2d")!;
    tempCtx.fillStyle = fillColor;
    tempCtx.fillRect(0, 0, 1, 1);
    const [fr, fg, fb, fa] = Array.from(tempCtx.getImageData(0, 0, 1, 1).data);

    if (fr === targetR && fg === targetG && fb === targetB && fa === targetA) return;

    const stack = [[Math.floor(x), Math.floor(y)]];
    const visited = new Uint8Array(1280 * 720);

    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cx >= 1280 || cy < 0 || cy >= 720) continue;
      const idx = cy * 1280 + cx;
      if (visited[idx]) continue;
      const dataIdx = idx * 4;
      if (data[dataIdx] !== targetR || data[dataIdx + 1] !== targetG || data[dataIdx + 2] !== targetB) continue;
      visited[idx] = 1;
      data[dataIdx] = fr; data[dataIdx + 1] = fg; data[dataIdx + 2] = fb; data[dataIdx + 3] = fa;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const pos = getPos(e);
    drawing.current = true;
    lastPos.current = pos;
    startPos.current = pos;

    if (tool === "fill") {
      floodFill(pos.x, pos.y, color);
      saveSnapshot();
      drawing.current = false;
      return;
    }

    if (tool === "pen" || tool === "eraser") {
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const pos = getPos(e);
    const pressure = e.pressure > 0 ? e.pressure : 1;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const overlay = overlayRef.current!;
    const octx = overlay.getContext("2d")!;

    if (tool === "pen") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize * pressure;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    } else if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = brushSize * 4 * pressure;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    } else {
      // Shape preview on overlay
      octx.clearRect(0, 0, 1280, 720);
      octx.strokeStyle = color;
      octx.lineWidth = brushSize;
      octx.setLineDash([]);
      const { x: sx, y: sy } = startPos.current;

      if (tool === "line") {
        octx.beginPath();
        octx.moveTo(sx, sy);
        octx.lineTo(pos.x, pos.y);
        octx.stroke();
      } else if (tool === "rect") {
        octx.strokeRect(sx, sy, pos.x - sx, pos.y - sy);
      } else if (tool === "circle") {
        const rx = Math.abs(pos.x - sx) / 2;
        const ry = Math.abs(pos.y - sy) / 2;
        const cx2 = (sx + pos.x) / 2;
        const cy2 = (sy + pos.y) / 2;
        octx.beginPath();
        octx.ellipse(cx2, cy2, rx, ry, 0, 0, Math.PI * 2);
        octx.stroke();
      }
    }

    lastPos.current = pos;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    const pos = getPos(e);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const overlay = overlayRef.current!;
    const octx = overlay.getContext("2d")!;

    // Finalize shapes
    if (tool === "line" || tool === "rect" || tool === "circle") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      const { x: sx, y: sy } = startPos.current;

      if (tool === "line") {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === "rect") {
        ctx.strokeRect(sx, sy, pos.x - sx, pos.y - sy);
      } else if (tool === "circle") {
        const rx = Math.abs(pos.x - sx) / 2;
        const ry = Math.abs(pos.y - sy) / 2;
        const cx2 = (sx + pos.x) / 2;
        const cy2 = (sy + pos.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx2, cy2, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      octx.clearRect(0, 0, 1280, 720);
    }

    ctx.globalCompositeOperation = "source-over";
    saveSnapshot();
  };

  const savePanel = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current!;
      const imageData = canvas.toDataURL("image/png");
      return (await apiRequest("POST", `/api/storyboards/${storyboardId}/panels`, {
        imageData,
        caption: "Sketched panel",
        dialogue: "",
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storyboards"] });
      toast({ title: "Panel saved!" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "pen", icon: <Pen size={16} />, label: "Pen" },
    { id: "eraser", icon: <Eraser size={16} />, label: "Eraser" },
    { id: "fill", icon: <PaintBucket size={16} />, label: "Fill" },
    { id: "line", icon: <Minus size={16} />, label: "Line" },
    { id: "rect", icon: <Square size={16} />, label: "Rect" },
    { id: "circle", icon: <Circle size={16} />, label: "Circle" },
  ];

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95 flex-shrink-0">
          <span className="font-display font-semibold text-sm">Sketch panel</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={undo} disabled={historyIdx <= 0} data-testid="button-sketch-undo">
              <Undo2 size={14} />
            </Button>
            <Button size="sm" variant="outline" onClick={redo} disabled={historyIdx >= history.length - 1} data-testid="button-sketch-redo">
              <Redo2 size={14} />
            </Button>
            <Button size="sm" variant="ghost" onClick={clearCanvas} data-testid="button-sketch-clear">
              <Trash2 size={14} className="mr-1" />Clear
            </Button>
            <Button size="sm" onClick={() => savePanel.mutate()} disabled={savePanel.isPending} data-testid="button-sketch-save">
              <Save size={14} className="mr-1" />{savePanel.isPending ? "Saving…" : "Save panel"}
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8" data-testid="button-sketch-close">
              <X size={14} />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left toolbar */}
          <div className="flex flex-col gap-2 p-3 border-r border-border bg-background/95 w-16 flex-shrink-0 items-center">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={t.label}
                data-testid={`button-sketch-tool-${t.id}`}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all border ${
                  tool === t.id
                    ? "bg-primary/15 border-primary text-primary"
                    : "border-transparent hover:bg-accent text-muted-foreground"
                }`}
              >
                {t.icon}
              </button>
            ))}

            <div className="w-full border-t border-border my-1" />

            {/* Color swatches */}
            <div className="grid grid-cols-2 gap-0.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  data-testid={`button-sketch-color-${c.replace("#", "")}`}
                  className={`w-4 h-4 rounded-sm border transition-all ${
                    color === c ? "ring-2 ring-primary ring-offset-1 scale-110" : "border-border"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Custom color picker */}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-9 h-9 rounded cursor-pointer border border-border"
              data-testid="input-sketch-color-picker"
              title="Custom color"
            />

            {/* Brush size */}
            <div className="w-full pt-1">
              <Slider
                value={[brushSize]}
                onValueChange={([v]) => setBrushSize(v)}
                min={1}
                max={40}
                step={1}
                orientation="vertical"
                className="h-24 mx-auto"
                data-testid="slider-brush-size"
              />
              <div className="text-[10px] text-center text-muted-foreground mt-1">{brushSize}px</div>
            </div>
          </div>

          {/* Canvas area */}
          <div className="flex-1 flex items-center justify-center bg-muted/30 overflow-hidden p-2">
            <div className="relative" style={{ maxWidth: "100%", maxHeight: "100%", aspectRatio: "16/9" }}>
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                style={{
                  width: "100%",
                  height: "100%",
                  cursor: tool === "eraser" ? "cell" : tool === "fill" ? "crosshair" : "default",
                  touchAction: "none",
                  display: "block",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                data-testid="canvas-sketch"
              />
              <canvas
                ref={overlayRef}
                width={1280}
                height={720}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
