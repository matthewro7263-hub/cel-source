import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Download, Eye } from "lucide-react";
import { formatTime } from "./types";
import type { AudCaption } from "@shared/schema";
import { buildSrt, buildVtt, downloadCaptionFile, parseCaptionTimeMs } from "./caption-export";

export function CaptionsPanel({ animaticId }: { animaticId: number }) {
  const [newText, setNewText] = useState("");
  const [newStart, setNewStart] = useState("00:00:00.000");
  const [newEnd, setNewEnd] = useState("00:00:02.000");

  const { data: captions = [] } = useQuery<AudCaption[]>({
    queryKey: [`/api/animatics/${animaticId}/aud/captions`],
  });

  const addCaption = useMutation({
    mutationFn: async () => {
      const startMs = parseCaptionTimeMs(newStart);
      const endMs = parseCaptionTimeMs(newEnd);
      if (startMs === null || endMs === null || endMs <= startMs) {
        throw new Error("Use HH:MM:SS.mmm timing, with end after start.");
      }
      
      const res = await apiRequest("POST", `/api/animatics/${animaticId}/aud/captions`, {
        text: newText,
        startMs,
        endMs,
      });
      return await res.json();
    },
    onSuccess: () => {
      setNewText("");
      queryClient.invalidateQueries({ queryKey: [`/api/animatics/${animaticId}/aud/captions`] });
    }
  });

  const deleteCaption = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/aud/captions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/animatics/${animaticId}/aud/captions`] });
    }
  });

  const sortedCaptions = [...captions].sort((a, b) => a.startMs - b.startMs);
  const previewCaption = sortedCaptions[0];

  const handleExportVTT = () => {
    downloadCaptionFile(`animatic-${animaticId}-captions.vtt`, buildVtt(captions), "text/vtt");
  };

  const handleExportSRT = () => {
    downloadCaptionFile(`animatic-${animaticId}-captions.srt`, buildSrt(captions), "application/x-subrip");
  };

  return (
    <div className="flex flex-col h-full bg-black/40 rounded-xl border border-white/10 p-4 gap-4">
      <div className="flex justify-between items-center gap-2">
        <h3 className="font-semibold text-sm">Captions</h3>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={handleExportVTT} disabled={captions.length === 0}>
            <Download size={14} className="mr-1.5" /> VTT
          </Button>
          <Button size="sm" variant="ghost" onClick={handleExportSRT} disabled={captions.length === 0}>
            <Download size={14} className="mr-1.5" /> SRT
          </Button>
        </div>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-slate-950 to-slate-800">
        <div className="absolute inset-0 grid place-items-center text-white/35">
          <Eye size={28} />
        </div>
        {previewCaption ? (
          <div className="absolute inset-x-6 bottom-5 rounded-md bg-black/65 px-4 py-2 text-center text-sm text-white shadow-lg">
            {previewCaption.text}
          </div>
        ) : (
          <div className="absolute inset-x-6 bottom-5 rounded-md bg-black/45 px-4 py-2 text-center text-xs text-white/60">
            Caption preview appears here.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {sortedCaptions.map(c => (
          <div key={c.id} className="flex items-center gap-3 p-2 rounded bg-white/5 text-sm">
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTime(c.startMs)} - {formatTime(c.endMs)}
            </div>
            <div className="flex-1 truncate">{c.text}</div>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => deleteCaption.mutate(c.id)}>
              <Trash2 size={12} />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
        <div className="flex gap-2">
          <Input 
            className="flex-1 text-xs" 
            placeholder="Start (HH:MM:SS.mmm)" 
            value={newStart} 
            onChange={e => setNewStart(e.target.value)} 
          />
          <Input 
            className="flex-1 text-xs" 
            placeholder="End (HH:MM:SS.mmm)" 
            value={newEnd} 
            onChange={e => setNewEnd(e.target.value)} 
          />
        </div>
        <div className="flex gap-2">
          <Input 
            placeholder="Caption text..." 
            value={newText} 
            onChange={e => setNewText(e.target.value)} 
            onKeyDown={e => e.key === "Enter" && addCaption.mutate()}
          />
          <Button onClick={() => addCaption.mutate()} disabled={!newText.trim() || addCaption.isPending}>
            <Plus size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
