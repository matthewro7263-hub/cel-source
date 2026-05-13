/**
 * "Add Audio Clip" dialog with three tabs:
 * 1. Upload — file input
 * 2. From Assets — project audio assets
 * 3. Freesound search
 */
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Play, Square, Plus, Search, Upload, Music } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { searchFreesound, getPreviewUrl } from "@/lib/freesound";
import type { FreesoundResult } from "@/lib/freesound";
import type { Asset } from "@shared/schema";

interface AudioDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  onAdd: (audioDataUrl: string | null, label: string, sourceKind: string, sourceId?: number | null) => void;
}

export function AudioDialog({ open, onClose, projectId, onAdd }: AudioDialogProps) {
  const [tab, setTab] = useState("upload");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<FreesoundResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const { data: assets } = useQuery<Omit<Asset, "fileData">[]>({
    queryKey: ["/api/projects", projectId, "assets"],
    queryFn: async () =>
      (await apiRequest("GET", `/api/projects/${projectId}/assets`)).json(),
    enabled: open,
  });

  const audioAssets = (assets || []).filter((a) =>
    a.mimeType.startsWith("audio/") || a.filename.match(/\.(mp3|wav|ogg|m4a|flac)$/i),
  );

  const handleFileUpload = async (f: File) => {
    if (f.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB for audio clips.", variant: "destructive" });
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(f);
    });
    onAdd(dataUrl, f.name, "audio_data", null);
    onClose();
  };

  const handleFreesoundSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const data = await searchFreesound(searchQ);
      setSearchResults(data.results || []);
    } catch (e: any) {
      toast({
        title: "Freesound search failed",
        description: e.message || "API key may not be configured.",
        variant: "destructive",
      });
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handlePreview = (sound: FreesoundResult) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (previewPlaying === sound.id) {
      setPreviewPlaying(null);
      return;
    }
    const url = getPreviewUrl(sound);
    if (!url) return;
    const audio = new Audio(url);
    audio.play().catch(() => {});
    audio.onended = () => setPreviewPlaying(null);
    previewAudioRef.current = audio;
    setPreviewPlaying(sound.id);
  };

  const handleFreesoundAdd = (sound: FreesoundResult) => {
    const url = getPreviewUrl(sound);
    // We use the direct CDN preview URL as the audioDataUrl equivalent
    // (stored as a URL, not base64)
    onAdd(url, sound.name, "audio_data", null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music size={16} />
            Add Audio Clip
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="flex-1"><Upload size={13} className="mr-1" />Upload</TabsTrigger>
            <TabsTrigger value="assets" className="flex-1"><Music size={13} className="mr-1" />Assets</TabsTrigger>
            <TabsTrigger value="freesound" className="flex-1"><Search size={13} className="mr-1" />Freesound</TabsTrigger>
          </TabsList>

          {/* ── Upload ── */}
          <TabsContent value="upload" className="py-4">
            <label className="flex flex-col items-center gap-3 border-2 border-dashed border-white/20 rounded-xl p-8 cursor-pointer hover:border-white/40 transition-colors">
              <Upload size={24} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Click to upload MP3, WAV, M4A, OGG</span>
              <span className="text-xs text-muted-foreground">Max 10MB</span>
              <input
                type="file"
                accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/ogg,audio/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
            </label>
          </TabsContent>

          {/* ── Assets ── */}
          <TabsContent value="assets" className="py-4">
            {audioAssets.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                No audio assets in this project yet.
                Upload audio files to the Assets tab first.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {audioAssets.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.filename}</p>
                      <p className="text-xs text-muted-foreground">{a.mimeType}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        // We'll load the fileData via the download endpoint
                        onAdd(null, a.filename, "asset_ref", a.id);
                        onClose();
                      }}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Freesound ── */}
          <TabsContent value="freesound" className="py-4 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search sound effects…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFreesoundSearch()}
              />
              <Button onClick={handleFreesoundSearch} disabled={searching} size="sm">
                <Search size={14} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Powered by{" "}
              <a href="https://freesound.org" target="_blank" rel="noreferrer" className="underline">
                Freesound.org
              </a>
              . Requires API key setup.
            </p>
            {searching && (
              <div className="text-center py-4 text-sm text-muted-foreground">Searching…</div>
            )}
            {!searching && searchResults.length === 0 && searchQ && (
              <div className="text-center py-4 text-sm text-muted-foreground">No results.</div>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((sound) => (
                <div
                  key={sound.id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                >
                  <button
                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                    onClick={() => handlePreview(sound)}
                  >
                    {previewPlaying === sound.id ? <Square size={13} /> : <Play size={13} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sound.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {sound.duration.toFixed(1)}s · by {sound.username}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleFreesoundAdd(sound)}
                  >
                    <Plus size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
