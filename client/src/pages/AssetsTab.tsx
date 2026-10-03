import { useState, useRef, useEffect } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Upload, Download, Trash2, Search, Layers, User, Box, FileImage,
  Music, File as FileIcon, Sparkles, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GlassButton } from "@/components/ui/glass-button";

import AssetRevisionTree from "./lor/AssetRevisionTree";
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

  const PAGE_SIZE = 24;

  const {
    data: assetPages,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["/api/projects", projectId, "assets", activeCategory === "All" ? undefined : activeCategory],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (activeCategory !== "All") params.set("category", activeCategory);
      if (pageParam) params.set("cursor", String(pageParam));
      const r = await apiRequest("GET", `/api/projects/${projectId}/assets?${params}`);
      const data = await r.json();
      if (Array.isArray(data)) return { items: data as AssetSafe[], nextCursor: null as number | null };
      return { items: (data.items ?? []) as AssetSafe[], nextCursor: data.nextCursor ?? null };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const assets = assetPages?.pages.flatMap((p) => p.items) ?? [];

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
    mutationFn: async () => (await apiRequest("POST", `/api/projects/${projectId}/assets/auto-tag`, {})).json() as Promise<{ tagged: number; failed: number; message?: string }>,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "assets"] });
      toast({
        title: data.tagged > 0 ? `Tagged ${data.tagged} asset${data.tagged === 1 ? "" : "s"}` : "Nothing to tag",
        description: data.message ?? (data.failed ? `${data.failed} couldn't be tagged. Try again in a moment.` : "Review the suggested tags in each asset's details."),
      });
    },
    onError: (err: Error) => toast({ title: "Auto-tag failed", description: err.message, variant: "destructive" }),
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    let uploadedAny = false;
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
        uploadedAny = true;
      } catch (err: any) {
        toast({ title: "Upload failed", description: String(err.message || err), variant: "destructive" });
      }
    }
    if (uploadedAny) {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "assets"] });
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
            onClick={() => autoTagAll.mutate()}
            disabled={autoTagAll.isPending}
            title="Suggest tags for untagged images using AI (needs an OpenRouter key in Project Settings)"
            data-testid="button-auto-tag"
            className="h-8"
          >
            {autoTagAll.isPending ? <Loader2 size={13} className="mr-1 animate-spin" /> : <Sparkles size={13} className="mr-1" />}
            {autoTagAll.isPending ? "Tagging…" : "Auto-tag"}
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
          {search ? (
            <>
              <p className="font-medium mb-1">No matching assets</p>
              <p className="text-xs mb-4 text-muted-foreground">
                Nothing matches "{search}". Try a different search or clear the filter.
              </p>
              <Button variant="outline" size="sm" onClick={() => setSearch("")} data-testid="button-clear-asset-search">
                Clear search
              </Button>
            </>
          ) : !assets || assets.length === 0 ? (
            <>
              <p className="font-medium mb-1">No assets yet</p>
              <p className="text-xs mb-4 text-muted-foreground">Upload characters, backgrounds, props, references — any file type.</p>
              <GlassButton variant="primary" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload size={13} className="mr-1" /> Upload files
              </GlassButton>
            </>
          ) : (
            <>
              <p className="font-medium mb-1">No assets in this category</p>
              <p className="text-xs text-muted-foreground">Try another category or upload new files.</p>
            </>
          )}
        </div>
      ) : (
        <>
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
          {hasNextPage && !search && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                data-testid="button-load-more-assets"
              >
                {isFetchingNextPage ? "Loading…" : "Load more assets"}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Asset detail modal */}
      <AssetModal
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onDelete={(id) => del.mutate(id)}
        onUpdate={(id, patch) => update.mutate({ id, patch })}
        onDownload={downloadAsset}
        onSelect={setSelectedAsset}
      />
    </div>
  );
}

function AssetCard({ asset, onClick, onDownload }: { asset: AssetSafe; onClick: () => void; onDownload: () => void }) {
  const isImage = asset.mimeType.startsWith("image/") && asset.thumbnailData;

  return (
    <div
      className="group relative rounded-xl border border-card-border bg-card overflow-hidden cursor-pointer hover:border-foreground/20 transition-all"
      onClick={onClick}
      data-testid={`asset-card-${asset.id}`}
    >
      {/* Preview area */}
      <div className="aspect-square bg-muted flex items-center justify-center relative">
        {isImage ? (
          <img src={asset.thumbnailData!} alt={asset.filename} className="w-full h-full object-cover" loading="lazy" decoding="async" />
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

type SimilarAsset = AssetSafe & { score: number };

function AssetModal({
  asset,
  onClose,
  onDelete,
  onUpdate,
  onDownload,
  onSelect,
}: {
  asset: AssetSafe | null;
  onClose: () => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, patch: { notes?: string; tags?: string; category?: string }) => void;
  onDownload: (asset: AssetSafe) => void;
  onSelect: (asset: AssetSafe) => void;
}) {
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");

  // Reset the form when a different asset is opened. (Setting state during render here used to
  // overwrite every keystroke with the saved value, so notes and tags couldn't be edited.)
  useEffect(() => {
    setNotes(asset?.notes ?? "");
    setTags(asset?.tags ?? "");
  }, [asset?.id]);

  const { data: similar } = useQuery({
    queryKey: ["/api/assets", asset?.id, "similar"],
    queryFn: async () => ((await apiRequest("GET", `/api/assets/${asset!.id}/similar`)).json()) as Promise<{ items: SimilarAsset[] }>,
    enabled: !!asset,
    staleTime: 30_000,
  });

  if (!asset) return null;

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
          <AssetRevisionTree assetId={asset.id} />
            </div>
          </div>
        </div>
        <div className="pt-1" data-testid="similar-assets">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Similar assets</span>
          {similar && similar.items.length > 0 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {similar.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  title={`${item.filename}${item.tags ? ` · ${item.tags}` : ""}`}
                  className="shrink-0 w-20 text-left"
                  data-testid={`similar-asset-${item.id}`}
                >
                  <div className="aspect-square rounded-md bg-muted overflow-hidden flex items-center justify-center border border-border">
                    {item.thumbnailData ? (
                      <img src={item.thumbnailData} alt={item.filename} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      getAssetIcon(item.mimeType, item.filename)
                    )}
                  </div>
                  <p className="mt-1 text-[10px] truncate">{item.filename}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {similar ? "Nothing similar yet. Matches are based on shared tags and filename words, so tagging assets improves this." : "Looking…"}
            </p>
          )}
        </div>
        <DialogFooter className="pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive mr-auto">
                <Trash2 size={13} className="mr-1.5" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this asset?</AlertDialogTitle>
                <AlertDialogDescription>"{asset.filename}" will be permanently removed from the project.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(asset.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
