import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Download, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ScratchpadPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [brushSize, setBrushSize] = useState(4);
  const [brushColor, setBrushColor] = useState("#111111");
  const [lastPressure, setLastPressure] = useState(0);
  const [lastTilt, setLastTilt] = useState({ x: 0, y: 0 });

  // Resize canvas to full window
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.lineCap = "round";
        context.lineJoin = "round";
        // Fill white background so it's a solid PNG
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        setCtx(context);
      }
    };
    
    window.addEventListener("resize", resize);
    resize();
    
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Swipe down to exit
  useEffect(() => {
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => { startY = e.touches[0].clientY; };
    const onTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0].clientY;
      if (endY - startY > 150) {
        // Swipe down detected
        setLocation("/dashboard");
      }
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [setLocation]);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ctx) return;
    setIsDrawing(true);
    // Hide controls when starting to draw on touch
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      setControlsVisible(false);
    }
    
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.clientX, e.nativeEvent.clientY);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctx) return;
    
    // Apple Pencil pressure support via PointerEvents
    const pressure = e.nativeEvent.pressure || 0.5;
    setLastPressure(pressure);
    setLastTilt({ x: e.nativeEvent.tiltX || 0, y: e.nativeEvent.tiltY || 0 });
    // Multiplier for Apple pencil pressure, clamped
    ctx.lineWidth = brushSize * (0.35 + pressure * 1.65);
    ctx.strokeStyle = brushColor;
    
    ctx.lineTo(e.nativeEvent.clientX, e.nativeEvent.clientY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.clientX, e.nativeEvent.clientY);
  };

  const stopDrawing = () => {
    if (!ctx) return;
    setIsDrawing(false);
    ctx.beginPath();
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // If not drawing (just a tap), toggle controls
    if (!isDrawing) {
      setControlsVisible(v => !v);
    }
  };

  const saveToInbox = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");

      await apiRequest("POST", "/api/inbox", {
        body: "Scratchpad Sketch",
        tags: "sketch",
        kind: "sketch",
        imageDataUrl: dataUrl,
      });
      
      toast({ title: "Saved to Inbox" });
      
      // Clear canvas
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } catch (e) {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const downloadCurrentPng = (filename = "scratchpad.png") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const downloadHeightmap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const temp = document.createElement("canvas");
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tempCtx = temp.getContext("2d");
    if (!tempCtx) return;
    tempCtx.drawImage(canvas, 0, 0);
    const data = tempCtx.getImageData(0, 0, temp.width, temp.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const r = data.data[i];
      const g = data.data[i + 1];
      const b = data.data[i + 2];
      const luminance = Math.round((r + g + b) / 3);
      const height = 255 - luminance;
      data.data[i] = height;
      data.data[i + 1] = height;
      data.data[i + 2] = height;
      data.data[i + 3] = 255;
    }
    tempCtx.putImageData(data, 0, 0);
    const a = document.createElement("a");
    a.href = temp.toDataURL("image/png");
    a.download = "scratchpad-heightmap.png";
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-hidden touch-none select-none">
      <canvas
        ref={canvasRef}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerOut={stopDrawing}
        onClick={handleCanvasClick}
        className="block touch-none"
        style={{ cursor: 'crosshair' }}
      />
      
      <div 
        className={`absolute top-4 left-4 right-4 flex justify-between transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <Button 
          variant="outline" 
          size="icon" 
          className="w-14 h-14 rounded-full glass bg-white/80 text-black shadow-lg"
          onClick={() => setLocation("/dashboard")}
        >
          <X className="w-6 h-6" />
        </Button>
        
        <div className="bg-white/80 glass px-6 py-2 rounded-full shadow-lg flex items-center gap-4 text-sm font-medium text-black">
          <span>Apple Pencil Scratchpad</span>
          <label className="flex items-center gap-2 text-xs">
            Size
            <input type="range" min="1" max="24" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
          </label>
          <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} aria-label="Brush color" />
          <span className="font-mono text-[11px] text-black/60">
            P {lastPressure.toFixed(2)} / tilt {lastTilt.x},{lastTilt.y}
          </span>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => downloadCurrentPng()}
            className="h-14 rounded-full bg-white/80 text-black shadow-lg"
          >
            <Download className="w-5 h-5" />
          </Button>
          <Button 
            variant="outline"
            onClick={downloadHeightmap}
            className="h-14 rounded-full bg-white/80 text-black shadow-lg"
          >
            Heightmap
          </Button>
          <Button 
            onClick={saveToInbox}
            disabled={saving}
            className="h-14 px-8 rounded-full bg-[#9DD0FF] hover:bg-[#AED9FF] text-black shadow-lg font-bold text-lg"
          >
            {saving ? "Saving..." : "Quick Save"}
            <Save className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
      
      {controlsVisible && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 text-white text-xs px-4 py-2 rounded-full backdrop-blur-md">
          Swipe down from top to exit
        </div>
      )}
    </div>
  );
}
