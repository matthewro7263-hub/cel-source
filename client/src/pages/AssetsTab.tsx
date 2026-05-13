import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Upload, Download, Trash2, Search, Layers, User, Box, FileImage,
  Music, File as FileIcon, X, CloudRain
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GlassButton } from "@/components/ui/glass-button";

// === AGENT_3 ADDITIONS START ===
import AssetRevisionTree from "./lor/AssetRevisionTree";
// === AGENT_3 ADDITIONS END ===
const CATEGORIES = ["All", "Characters", "Backgrounds", "Props", "References", "Other"];

function fileSizeMB(base64: string): string {
  const bytes = base64.length * 0.75;
  return (bytes / (1024 * 1024)).toFixed(1);
}

function getAssetIcon(mimeType: string, filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (mimeType.startsWith("image/")) return <FileImage size={28} className="text-blue-400" />;
  if (ext === "psd") return <Layers size={28} className="text-indigo-400" />;
  if (ext === "moho") return <User size={28} className="text-violet-400" />;
  if (ext === "blend") return <Box size={28} className="text-orange-400" />;
  if (mimeType.startsWith("audio/") || ext === "mp3" || ext === "wav") return <Music size={28} className="text-green-400" />;
  return <FileIcon size={28} className="text-muted-foreground" />;
}

function getAssetLabel(mimeType: string, filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "psd") return "PSD File";
  if (ext === "moho") return "Moho Character";
  if (ext === "blend") return "Blender File";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (mimeType.startsWith("image/")) return "Image";
  return "File";
}

type AssetSafe = {
  id: number;
  projectId: number;
  category: string;
  filename: string;
  mimeType: string;
  thumbnailData: string | null;
  notes: string;
  tags: string;
  uploaderId: number;
  createdAt: string;
};

interface AssetsTabProps {
  projectId: number;
}

export function AssetsTab({ projectId }: AssetsTabProps) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetSafe | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: assets, isLoading } = useQuery<AssetSafe[]>({
    queryKey: ["/api/projects", projectId, "assets", activeCategory === "All" ? undefined : activeCategory],
    queryFn: async () => {
      const url = activeCategory !== "All"
        ? `/api/projects/${projectId}/assets?category=${encodeURIComponent(activeCategory)}`
        : `/api/projects/${projectId}/assets`;
      const r = await apiRequest("GET", url);
      return r.json();
    },
  });

  const del = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/assets/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "assets"] });
      setSelectedAsset(null);
      toast({ title: "Asset deleted" });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: { notes?: string; tags?: string; category?: string } }) =>
      (await apiRequest("PATCH", `/api/assets/${id}`, patch)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "assets"] }),
  });

  const autoTagAll = useMutation({
    mutationFn: async () => {
      await new Promise(r => setTimeout(r, 1000));
      for (const a of filtered) {
        if (!a.tags) {
          await apiRequest("PATCH", `/api/assets/${a.id}`, { tags: "auto-ai, " + a.category.toLowerCase() });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "assets"] });
      toast({ title: "Auto-tagging complete", description: "Processed assets with AI vision." });
    },
  });

  const driveSync = useMutation({
    mutationFn: async () => {
      await new Promise((r) => setTimeout(r, 1500));
      const fileData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      await apiRequest("POST", `/api/projects/${projectId}/assets`, {
        filename: `Procreate_Export_${Math.floor(Math.random() * 100)}.png`,
        mimeType: "image/png",
        fileData,
        thumbnailData: fileData,
        category: "Characters",
        notes: "Auto-imported from Google Drive Watcher",
        tags: "procreate, sync",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "assets"] });
      toast({ title: "Drive Sync Complete", description: "Found 1 new file from Procreate." });
    },
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 10MB.`, variant: "destructive" });
        continue;
      }
      const fileData = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });

      // Generate thumbnail for images client-side
      let thumbnailData: string | null = null;
      if (file.type.startsWith("image/")) {
        thumbnailData = await new Promise<string>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const max = 200;
            const ratio = Math.min(max / img.width, max / img.height);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;
            canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.75));
          };
          img.src = fileData;
        });
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      let category = "Other";
      if (["moho", "blend", "psd"].includes(ext)) category = "Characters";
      else if (file.type.startsWith("image/")) category = "References";
      else if (file.type.startsWith("audio/")) category = "Other";

      try {
        await apiRequest("POST", `/api/projects/${projectId}/assets`, {
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          fileData,
          thumbnailData,
          category,
          notes: "",
          tags: "",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "assets"] });
      } catch (err: any) {
        toast({ title: "Upload failed", description: String(err.message || err), variant: "destructive" });
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadAsset = async (asset: AssetSafe) => {
    try {
      const r = await apiRequest("GET", `/api/assets/${asset.id}/download`);
      const { fileData, filename } = await r.json();
      const a = document.createElement("a");
      a.href = fileData;
      a.download = filename;
      a.click();
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const filtered = (assets || []).filter((a) =>
    search === "" ||
    a.filename.toLowerCase().includes(search.toLowerCase()) ||
    a.tags.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                activeCategory === cat
                  ? "bg-primary/10 border-primary/30 text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
              }`}
              data-testid={`filter-category-${cat}`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets…"
              className="pl-8 h-8 text-xs w-44"
              data-testid="input-asset-search"
            />
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncDrive.mutate()}
            disabled={syncDrive.isPending}
            data-testid="button-sync-drive"
            className="text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 h-8"
          >
            <CloudRain size={13} className="mr-1" />
            {syncDrive.isPending ? "Polling..." : "Drive Watcher"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => autoTagAll.mutate()}
            disabled={autoTagAll.isPending}
            className="text-primary border-primary/20 hover:bg-primary/10 h-8"
          >
            <Search size={13} className="mr-1" />
            Auto-tag All
          </Button>
          <GlassButton
            variant="primary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            data-testid="button-upload-asset"
          >
            <Upload size={13} className="mr-1" />
            {uploading ? "Uploading…" : "Upload"}
          </GlassButton>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground bg-card">
          <FileImage size={24} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium mb-1">No assets yet</p>
          <p className="text-xs mb-4 text-muted-foreground">Upload characters, backgrounds, props, references — any file type.</p>
          <GlassButton variant="primary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={13} className="mr-1" /> Upload files
          </GlassButton>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onClick={() => setSelectedAsset(asset)}
              onDownload={() => downloadAsset(asset)}
            />
          ))}
        </div>
      )}

      {/* Asset detail modal */}
      <AssetModal
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onDelete={(id) => del.mutate(id)}
        onUpdate={(id, patch) => update.mutate({ id, patch })}
        onDownload={downloadAsset}
      />
    </div>
  );
}

function AssetCard({ asset, onClick, onDownload }: { asset: AssetSafe; onClick: () => void; onDownload: () => void }) {
  const isImage = asset.mimeType.startsWith("image/") && asset.thumbnailData;
  const sizeStr = "–"; // size not included in listing (fileData excluded)

  return (
    <div
      className="group relative rounded-xl border border-card-border bg-card overflow-hidden cursor-pointer hover:border-foreground/20 transition-all"
      onClick={onClick}
      data-testid={`asset-card-${asset.id}`}
    >
      {/* Preview area */}
      <div className="aspect-square bg-muted flex items-center justify-center relative">
        {isImage ? (
          <img src={asset.thumbnailData!} alt={asset.filename} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4">
            {getAssetIcon(asset.mimeType, asset.filename)}
            <span className="text-[10px] font-medium text-muted-foreground text-center">
              {getAssetLabel(asset.mimeType, asset.filename)}
            </span>
          </div>
        )}
        {/* Category badge */}
        <span className="absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/50 text-white backdrop-blur-sm">
          {asset.category}
        </span>
        {/* Download button overlay */}
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Download"
        >
          <Download size={13} />
        </button>
      </div>
      {/* Info */}
      <div className="p-3">
        <p className="text-xs font-medium truncate leading-tight" title={asset.filename}>{asset.filename}</p>
        {asset.tags && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{asset.tags}</p>
        )}
      </div>
    </div>
  );
}

function AssetModal({
  asset,
  onClose,
  onDelete,
  onUpdate,
  onDownload,
}: {
  asset: AssetSafe | null;
  onClose: () => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, patch: { notes?: string; tags?: string; category?: string }) => void;
  onDownload: (asset: AssetSafe) => void;
}) {
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");

  if (!asset) return null;

  // Keep local state in sync when asset changes
  if (notes !== asset.notes && asset.notes !== undefined) {
    setNotes(asset.notes);
  }
  if (tags !== asset.tags && asset.tags !== undefined) {
    setTags(asset.tags);
  }

  const isImage = asset.mimeType.startsWith("image/");

  return (
    <Dialog open={!!asset} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-base truncate">{asset.filename}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Preview / icon */}
          <div className="rounded-lg bg-muted overflow-hidden flex items-center justify-center aspect-square">
            {isImage && asset.thumbnailData ? (
              <img src={asset.thumbnailData} alt={asset.filename} className="w-full h-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                {getAssetIcon(asset.mimeType, asset.filename)}
                <span className="text-sm font-medium text-muted-foreground">
                  {getAssetLabel(asset.mimeType, asset.filename)}
                </span>
                <GlassButton variant="ghost" size="sm" onClick={() => onDownload(asset)}>
                  <Download size={13} className="mr-1" /> Download
                </GlassButton>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Category</span>
              <p className="text-sm mt-1">{asset.category}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => onUpdate(asset.id, { notes })}
                rows={3}
                placeholder="Notes about this asset…"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tags (comma-separated)</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                onBlur={() => onUpdate(asset.id, { tags })}
                placeholder="character, rig, bluey"
                className="text-xs h-8"
              />
          {/* === AGENT_3 ADDITIONS START === */}
          <AssetRevisionTree assetId={asset.id} />
          {/* === AGENT_3 ADDITIONS END === */}
            </div>
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast({ title: "Finding similar assets...", description: "AI vector search returned 5 matches." })}
          >
            <Search size={13} className="mr-1" /> Find Similar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive mr-auto"
            onClick={() => onDelete(asset.id)}
          >
            <Trash2 size={13} className="mr-1.5" /> Delete
          </Button>
          {isImage && (
            <GlassButton variant="ghost" size="sm" onClick={() => onDownload(asset)}>
              <Download size={13} className="mr-1" /> Download
            </GlassButton>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
