import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PenTool, CheckCircle2, Eraser } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function CliApprovalWidget({ projectId, phase, brandColor = "#9DD0FF" }: { projectId: number, phase: string, brandColor?: string }) {
  const [open, setOpen] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false); // mutable ref for immediate read in event handlers
  const { toast } = useToast();

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setSignedName("");
      setTimeout(clearCanvas, 100);
    }
  }, [open, clearCanvas]);

  const getCanvasCoords = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    drawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const stopDrawing = () => {
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.beginPath();
    }
  };

  const draw = (e: any) => {
    e.preventDefault();
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const { data: approvals = [] } = useQuery({
    queryKey: ["/api/projects", projectId, "cli_approvals"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/cli_approvals`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const approvalData = approvals.find((a: any) => a.phase === phase);
  const isApproved = !!approvalData;

  const handleSubmit = async () => {
    if (!signedName.trim()) {
      toast({ title: "Please type your name", variant: "destructive" });
      return;
    }

    const canvas = canvasRef.current;
    const signatureData = canvas ? canvas.toDataURL() : signedName;

    setIsSubmitting(true);
    try {
      await apiRequest("POST", `/api/projects/${projectId}/cli_approvals`, {
        phase,
        signedName: signedName.trim(),
        signatureData,
        signedAt: new Date().toISOString()
      });

      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "cli_approvals"] });
      toast({ title: "Approved successfully" });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Failed to approve", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isApproved && approvalData) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm" style={{ backgroundColor: `${brandColor}15`, borderColor: `${brandColor}30`, color: brandColor }}>
        <CheckCircle2 size={16} />
        <span>Approved by {approvalData.signedName}</span>
      </div>
    );
  }

  const phaseLabel = phase.charAt(0).toUpperCase() + phase.slice(1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" style={{ backgroundColor: brandColor, color: "#000" }}>
          <PenTool size={16} /> Approve {phaseLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve {phaseLabel}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            By signing below, you are officially approving the <strong>{phase}</strong> phase of this project.
          </p>

          <div className="space-y-2">
            <Label htmlFor={`sig-name-${phase}`}>Full Name</Label>
            <Input
              id={`sig-name-${phase}`}
              value={signedName}
              onChange={(e) => setSignedName(e.target.value)}
              placeholder="Jane Doe"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>E-Signature</Label>
              <Button variant="ghost" size="sm" onClick={clearCanvas} className="h-6 text-[10px] gap-1">
                <Eraser size={10} /> Clear
              </Button>
            </div>
            <div className="relative border rounded-md bg-white overflow-hidden touch-none" style={{ borderColor: `${brandColor}40` }}>
              <canvas
                ref={canvasRef}
                width={400}
                height={120}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-[120px] cursor-crosshair"
              />
              {/* Faint guide line */}
              <div className="absolute bottom-6 left-6 right-6 border-b border-dashed pointer-events-none" style={{ borderColor: `${brandColor}30` }} />
            </div>
            <p className="text-[10px] text-muted-foreground">Draw your signature above the line</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !signedName.trim()} style={{ backgroundColor: brandColor, color: "#000" }}>
            {isSubmitting ? "Signing..." : "Sign & Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}