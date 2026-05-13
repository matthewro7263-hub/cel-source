import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Copy, Plus, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useRoute } from "wouter";
import { comparePaletteSimilarity } from "./palette-model";

// Simple in-browser color quantization
async function extractColors(file: File): Promise<Record<string, number>> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve({});
      
      // scale down to speed up processing
      const maxW = 200;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      
      const colorCounts: Record<string, number> = {};
      
      // sample every 4th pixel for speed
      for (let i = 0; i < imageData.length; i += 16) {
        const r = Math.floor(imageData[i] / 16) * 16; // bucket to reduce noise
        const g = Math.floor(imageData[i+1] / 16) * 16;
        const b = Math.floor(imageData[i+2] / 16) * 16;
        const a = imageData[i+3];
        
        if (a < 128) continue; // skip transparent
        
        // to hex
        const hex = "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
      }
      
      resolve(colorCounts);
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  });
}

export default function PaletteMatcher() {
  const [, params] = useRoute("/projects/:id/palette");
  const projectId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [extracting, setExtracting] = useState(false);
  const [compareScore, setCompareScore] = useState<number | null>(null);
  const [renderColors, setRenderColors] = useState<string[]>([]);
  
  const { data: palettes = [], isLoading } = useQuery<any[]>({ queryKey: [`/api/projects/${projectId}/lor_palettes`] });

  const createPalette = useMutation({
    mutationFn: async (palette: any) => {
      await apiRequest("POST", `/api/projects/${projectId}/lor_palettes`, palette);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/lor_palettes`] })
  });

  const delPalette = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/lor_palettes/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/lor_palettes`] })
  });

  const topColorsFromCounts = (counts: Record<string, number>, limit = 6) => {
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([color]) => color);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (files.length > 8) {
      toast({ title: "Too many files", description: "Max 8 files per batch", variant: "destructive" });
      return;
    }
    
    setExtracting(true);
    try {
      const globalColorCounts: Record<string, number> = {};

      for (const f of files) {
        const extracted = await extractColors(f);
        for (const [color, count] of Object.entries(extracted)) {
          globalColorCounts[color] = (globalColorCounts[color] || 0) + count;
        }
      }

      const finalColors = topColorsFromCounts(globalColorCounts);
      
      if (finalColors.length) {
        await createPalette.mutateAsync({ name: "Extracted Palette", colors: finalColors });
        toast({ title: "Palette extracted successfully" });
      }
    } catch (err) {
      toast({ title: "Error extracting colors", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleCompareUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reference = palettes[0] ? JSON.parse((palettes[0] as any).colors) as string[] : [];
    if (!reference.length) {
      toast({ title: "Extract a reference palette first", variant: "destructive" });
      return;
    }

    setExtracting(true);
    try {
      const colors = topColorsFromCounts(await extractColors(file));
      setRenderColors(colors);
      setCompareScore(comparePaletteSimilarity(colors, reference));
    } catch {
      toast({ title: "Error comparing render", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const copyCSS = (palette: any) => {
    try {
      const colors = JSON.parse(palette.colors);
      const css = `:root {\n${colors.map((c: string, i: number) => `  --color-${i+1}: ${c};`).join("\n")}\n}`;
      navigator.clipboard.writeText(css);
      toast({ title: "Copied to clipboard as CSS variables" });
    } catch {
      toast({ title: "Failed to parse colors", variant: "destructive" });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold font-display">Color Palette Matcher</h1>
        <div className="relative">
          <Input 
            type="file" 
            accept="image/*" 
            multiple 
            onChange={handleUpload} 
            disabled={extracting}
            className="absolute inset-0 opacity-0 cursor-pointer w-full" 
            title="Upload screenshots"
          />
          <Button disabled={extracting} className="bg-[#9DD0FF] hover:bg-[#AED9FF] text-black">
            <Plus size={16} className="mr-2" /> 
            {extracting ? "Extracting..." : "Upload Source Stills"}
          </Button>
        </div>
      </div>
      
      <p className="text-muted-foreground mb-8">
        Upload up to 8 screenshots from the source show. The tool will extract the dominant colors to help you match the official palette.
      </p>

      {palettes.length > 0 && (
        <div className="mb-8 rounded-lg border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Render Match Check</h2>
              <p className="text-xs text-muted-foreground">Upload your current render to compare its dominant colors to the newest reference palette.</p>
            </div>
            <div className="relative">
              <Input
                type="file"
                accept="image/*"
                onChange={handleCompareUpload}
                disabled={extracting}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                title="Compare render"
              />
              <Button variant="outline" disabled={extracting}>Compare Render</Button>
            </div>
          </div>
          {compareScore !== null && (
            <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
              <div className="rounded-lg border p-4 text-center">
                <div className="text-xs text-muted-foreground">Palette match</div>
                <div className="text-3xl font-bold">{compareScore}%</div>
              </div>
              <div className="flex h-20 overflow-hidden rounded-md border">
                {renderColors.map((color) => (
                  <div key={color} className="flex-1" style={{ backgroundColor: color }} title={color} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-center">Loading...</div>
      ) : palettes.length === 0 ? (
        <div className="bg-card border border-dashed rounded-lg p-16 text-center text-muted-foreground">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p>No palettes generated yet. Upload some screenshots to start.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {palettes.map((p: any) => {
            const colors = JSON.parse(p.colors) as string[];
            return (
              <div key={p.id} className="bg-card rounded-lg border p-6 flex flex-col sm:flex-row gap-6 items-center">
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">{p.name}</h3>
                    <div className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex rounded-md overflow-hidden h-24 w-full shadow-inner">
                    {colors.map((c, i) => (
                      <div 
                        key={i} 
                        className="flex-1 transition-all hover:flex-[1.5] flex items-end justify-center pb-2 cursor-pointer group relative"
                        style={{ backgroundColor: c }}
                        onClick={() => { navigator.clipboard.writeText(c); toast({title:"Copied hex code"}); }}
                      >
                        <span className="text-[10px] font-mono bg-black/50 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          {c}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto">
                  <Button variant="outline" className="flex-1" onClick={() => copyCSS(p)}>
                    <Copy size={14} className="mr-2" /> CSS
                  </Button>
                  <Button variant="ghost" className="text-destructive flex-1" onClick={() => delPalette.mutate(p.id)}>
                    <Trash2 size={14} className="mr-2" /> Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
