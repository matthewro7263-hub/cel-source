import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Blend, Download, ImagePlus, PaintBucket, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  buildInbetweenFrames,
  clampInbetweenCount,
  floodFillPixels,
  hexToRgb,
} from "./inbetween-color-model";

const PREVIEW_WIDTH = 960;
const PREVIEW_HEIGHT = 540;
const FLAT_MAX_WIDTH = 960;
const FLAT_MAX_HEIGHT = 640;

type ImageSource = {
  url: string;
  name: string;
};

function objectUrlFromFile(file: File | null): ImageSource | null {
  if (!file) return null;
  return {
    url: URL.createObjectURL(file),
    name: file.name,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image"));
    img.src = src;
  });
}

function downloadCanvas(canvas: HTMLCanvasElement | null, filename: string) {
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0,
) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = ((width - drawWidth) / 2) + offsetX;
  const y = ((height - drawHeight) / 2) + offsetY;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function replaceSource(setter: (value: ImageSource | null) => void, current: ImageSource | null, file: File | null) {
  if (current) URL.revokeObjectURL(current.url);
  setter(objectUrlFromFile(file));
}

export default function InbetweenColorLab() {
  const [, params] = useRoute("/projects/:id/inbetween");
  const projectId = Number.parseInt(params?.id || "0", 10);
  const { toast } = useToast();
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const flatCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const keyARef = useRef<ImageSource | null>(null);
  const keyBRef = useRef<ImageSource | null>(null);
  const flatImageRef = useRef<ImageSource | null>(null);
  const [keyA, setKeyA] = useState<ImageSource | null>(null);
  const [keyB, setKeyB] = useState<ImageSource | null>(null);
  const [frameCount, setFrameCount] = useState(5);
  const [selectedFrame, setSelectedFrame] = useState(1);
  const [onionSkin, setOnionSkin] = useState(true);
  const [motionGuide, setMotionGuide] = useState(18);
  const [flatImage, setFlatImage] = useState<ImageSource | null>(null);
  const [fillColor, setFillColor] = useState("#9DD0FF");
  const [tolerance, setTolerance] = useState(36);
  const [filledPixels, setFilledPixels] = useState<number | null>(null);

  const frames = useMemo(() => buildInbetweenFrames(frameCount), [frameCount]);
  const currentFrame = frames[Math.min(selectedFrame - 1, frames.length - 1)] ?? frames[0];

  useEffect(() => {
    setSelectedFrame((current) => Math.min(current, frames.length));
  }, [frames.length]);

  useEffect(() => {
    keyARef.current = keyA;
  }, [keyA]);

  useEffect(() => {
    keyBRef.current = keyB;
  }, [keyB]);

  useEffect(() => {
    return () => {
      if (keyARef.current) URL.revokeObjectURL(keyARef.current.url);
      if (keyBRef.current) URL.revokeObjectURL(keyBRef.current.url);
      if (flatImageRef.current) URL.revokeObjectURL(flatImageRef.current.url);
    };
  }, []);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let cancelled = false;
    canvas.width = PREVIEW_WIDTH;
    canvas.height = PREVIEW_HEIGHT;
    ctx.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    ctx.fillStyle = "#0B0D12";
    ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

    if (!keyA && !keyB) {
      ctx.fillStyle = "rgba(255,255,255,0.54)";
      ctx.font = "600 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Drop in two key drawings", PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2);
      return;
    }

    Promise.all([
      keyA ? loadImage(keyA.url) : Promise.resolve(null),
      keyB ? loadImage(keyB.url) : Promise.resolve(null),
    ]).then(([start, end]) => {
      if (cancelled) return;
      const alpha = currentFrame?.alpha ?? 0.5;
      const offset = motionGuide;

      ctx.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
      ctx.fillStyle = "#0B0D12";
      ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

      if (onionSkin && start) {
        ctx.globalAlpha = 0.18;
        drawContainedImage(ctx, start, PREVIEW_WIDTH, PREVIEW_HEIGHT, -offset, 0);
      }
      if (onionSkin && end) {
        ctx.globalAlpha = 0.18;
        drawContainedImage(ctx, end, PREVIEW_WIDTH, PREVIEW_HEIGHT, offset, 0);
      }
      if (start) {
        ctx.globalAlpha = 1 - alpha;
        drawContainedImage(ctx, start, PREVIEW_WIDTH, PREVIEW_HEIGHT, -offset * alpha, 0);
      }
      if (end) {
        ctx.globalAlpha = alpha;
        drawContainedImage(ctx, end, PREVIEW_WIDTH, PREVIEW_HEIGHT, offset * (1 - alpha), 0);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(157,208,255,0.88)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, PREVIEW_WIDTH - 2, PREVIEW_HEIGHT - 2);
    }).catch(() => {
      toast({ title: "Image preview failed", variant: "destructive" });
    });

    return () => {
      cancelled = true;
    };
  }, [currentFrame?.alpha, keyA, keyB, motionGuide, onionSkin, toast]);

  const drawFlatImage = useCallback((source: ImageSource | null) => {
    const canvas = flatCanvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx || !source) return;

    loadImage(source.url).then((img) => {
      const scale = Math.min(1, FLAT_MAX_WIDTH / img.width, FLAT_MAX_HEIGHT / img.height);
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setFilledPixels(null);
    }).catch(() => {
      toast({ title: "Line art preview failed", variant: "destructive" });
    });
  }, [toast]);

  useEffect(() => {
    flatImageRef.current = flatImage;
    drawFlatImage(flatImage);
  }, [drawFlatImage, flatImage]);

  const exportSpriteSheet = async () => {
    if (!keyA && !keyB) return;
    const start = keyA ? await loadImage(keyA.url) : null;
    const end = keyB ? await loadImage(keyB.url) : null;
    const sheetFrames = [{ alpha: 0 }, ...frames, { alpha: 1 }];
    const cellWidth = 320;
    const cellHeight = 180;
    const sheet = document.createElement("canvas");
    sheet.width = cellWidth * sheetFrames.length;
    sheet.height = cellHeight;
    const ctx = sheet.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0B0D12";
    ctx.fillRect(0, 0, sheet.width, sheet.height);

    sheetFrames.forEach((frame, idx) => {
      ctx.save();
      ctx.translate(idx * cellWidth, 0);
      if (start) {
        ctx.globalAlpha = 1 - frame.alpha;
        drawContainedImage(ctx, start, cellWidth, cellHeight, -motionGuide * frame.alpha * 0.35, 0);
      }
      if (end) {
        ctx.globalAlpha = frame.alpha;
        drawContainedImage(ctx, end, cellWidth, cellHeight, motionGuide * (1 - frame.alpha) * 0.35, 0);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.strokeRect(0.5, 0.5, cellWidth - 1, cellHeight - 1);
      ctx.restore();
    });

    downloadCanvas(sheet, `project-${projectId || "cel"}-inbetweens.png`);
  };

  const fillRegion = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = flatCanvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx || !flatImage) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = floodFillPixels({
      data: imageData.data,
      width: canvas.width,
      height: canvas.height,
      x,
      y,
      fill: hexToRgb(fillColor),
      tolerance,
    });

    ctx.putImageData(new ImageData(result.data, canvas.width, canvas.height), 0, 0);
    setFilledPixels(result.changed);
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-7 lg:px-10 lg:py-10">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Wand2 size={14} /> Project {Number.isFinite(projectId) ? projectId : ""}
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Inbetween & Flatting Lab</h1>
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>
          Back
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Blend size={18} className="text-primary" />
              <h2 className="font-display text-lg font-semibold">Inbetween frames</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0"
                  onChange={(event) => replaceSource(setKeyA, keyA, event.target.files?.[0] ?? null)}
                  data-testid="input-keyframe-a"
                />
                <Button variant="outline" type="button" asChild>
                  <span><ImagePlus size={15} className="mr-2" /> Key A</span>
                </Button>
              </label>
              <label className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0"
                  onChange={(event) => replaceSource(setKeyB, keyB, event.target.files?.[0] ?? null)}
                  data-testid="input-keyframe-b"
                />
                <Button variant="outline" type="button" asChild>
                  <span><ImagePlus size={15} className="mr-2" /> Key B</span>
                </Button>
              </label>
            </div>
          </div>

          <canvas
            ref={previewCanvasRef}
            className="aspect-video w-full rounded-md border bg-black"
            data-testid="canvas-inbetween-preview"
          />

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <Label className="text-xs">Frames</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={frameCount}
                onChange={(event) => setFrameCount(clampInbetweenCount(Number(event.target.value)))}
                className="mt-2 font-mono"
                data-testid="input-inbetween-count"
              />
            </div>
            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label className="text-xs">
                  {currentFrame ? (
                    <>
                      Inbetween <span className="font-mono">{currentFrame.index}</span>
                    </>
                  ) : (
                    "Inbetween 1"
                  )}
                </Label>
                <span className="text-xs text-muted-foreground font-mono">{Math.round((currentFrame?.alpha ?? 0.5) * 100)}%</span>
              </div>
              <Slider
                min={1}
                max={frames.length}
                step={1}
                value={[selectedFrame]}
                onValueChange={(value) => setSelectedFrame(value[0] ?? 1)}
                data-testid="slider-inbetween-frame"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="onion-skin" className="text-xs">Onion skin</Label>
              <Switch id="onion-skin" checked={onionSkin} onCheckedChange={setOnionSkin} />
            </div>
            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label className="text-xs">Motion guide</Label>
                <span className="text-xs text-muted-foreground">{motionGuide}px</span>
              </div>
              <Slider
                min={0}
                max={80}
                step={1}
                value={[motionGuide]}
                onValueChange={(value) => setMotionGuide(value[0] ?? 0)}
                data-testid="slider-motion-guide"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={() => downloadCanvas(previewCanvasRef.current, `project-${projectId || "cel"}-${currentFrame?.label.replace(/\s+/g, "-").toLowerCase() || "inbetween"}.png`)}
              disabled={!keyA && !keyB}
              data-testid="button-export-current-inbetween"
            >
              <Download size={15} className="mr-2" /> Current PNG
            </Button>
            <Button variant="outline" onClick={exportSpriteSheet} disabled={!keyA && !keyB} data-testid="button-export-inbetween-sheet">
              <Download size={15} className="mr-2" /> Sprite Sheet
            </Button>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PaintBucket size={18} className="text-primary" />
              <h2 className="font-display text-lg font-semibold">Color flatting</h2>
            </div>
            <label className="relative">
              <Input
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0"
                onChange={(event) => {
                  replaceSource(setFlatImage, flatImageRef.current, event.target.files?.[0] ?? null);
                }}
                data-testid="input-line-art"
              />
              <Button variant="outline" type="button" asChild>
                <span><ImagePlus size={15} className="mr-2" /> Line Art</span>
              </Button>
            </label>
          </div>

          <div className="overflow-hidden rounded-md border bg-white">
            <canvas
              ref={flatCanvasRef}
              width={720}
              height={440}
              onClick={fillRegion}
              className="block min-h-[320px] w-full cursor-crosshair object-contain"
              data-testid="canvas-flatting"
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-[96px_1fr]">
            <div>
              <Label className="text-xs">Fill</Label>
              <Input
                type="color"
                value={fillColor}
                onChange={(event) => setFillColor(event.target.value)}
                className="mt-2 h-10 p-1"
                data-testid="input-fill-color"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label className="text-xs">Tolerance</Label>
                <span className="text-xs text-muted-foreground">{tolerance}</span>
              </div>
              <Slider
                min={0}
                max={120}
                step={1}
                value={[tolerance]}
                onValueChange={(value) => setTolerance(value[0] ?? 0)}
                data-testid="slider-fill-tolerance"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => drawFlatImage(flatImage)} disabled={!flatImage}>
              <RefreshCw size={15} className="mr-2" /> Reset
            </Button>
            <Button onClick={() => downloadCanvas(flatCanvasRef.current, `project-${projectId || "cel"}-flats.png`)} disabled={!flatImage} data-testid="button-export-flats">
              <Download size={15} className="mr-2" /> Flats PNG
            </Button>
            {filledPixels !== null && (
              <span className="text-xs text-muted-foreground">{filledPixels.toLocaleString()} px filled</span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
