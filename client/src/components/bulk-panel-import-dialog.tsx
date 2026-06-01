import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon, Upload, X, Grid, Loader2, ArrowUpDown } from "lucide-react";
import { naturalSortBy } from "@/lib/natural-sort";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Scene } from "@shared/schema";

interface BulkImportDialogProps {
  storyboardId: number;
  projectId: number;
  onSuccess: () => void;
}

interface PendingPanel {
  id: string; // client-side temp id for sorting/tracking
  file: File;
  previewUrl: string;
  filename: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

export function BulkImportDialog({ storyboardId, projectId, onSuccess }: BulkImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<PendingPanel[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>("none");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Fetch project scenes for attachment
  const { data: scenes } = useQuery<Scene[]>({
    queryKey: [`/api/projects/${projectId}/scenes`],
  });

  // Cleanup object URLs on unmount or file reset
  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [files]);

  const addFilesToList = (fileList: FileList | File[]) => {
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"];
    const newFiles: PendingPanel[] = [];

    Array.from(fileList).forEach((file) => {
      const isHeic = file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");
      if (!validTypes.includes(file.type) && !isHeic) {
        toast({
          title: "Unsupported file",
          description: `${file.name} is not a valid image.`,
          variant: "destructive",
        });
        return;
      }

      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      newFiles.push({
        id,
        file,
        previewUrl: isHeic ? "" : URL.createObjectURL(file), // HEIC cannot preview natively in browser
        filename: file.name,
        status: "pending",
        progress: 0,
      });
    });

    // Auto natural sort new files by filename before adding to state
    const sortedNew = naturalSortBy(newFiles, (f) => f.filename);
    setFiles((prev) => [...prev, ...sortedNew]);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploading) return;

    const droppedFiles: File[] = [];
    const items = e.dataTransfer.items;

    if (items) {
      const traverseDirectory = async (item: any) => {
        if (item.isFile) {
          const file = await new Promise<File>((resolve) => item.file(resolve));
          droppedFiles.push(file);
        } else if (item.isDirectory) {
          const reader = item.createReader();
          const readEntries = async () => {
            const entries = await new Promise<any[]>((resolve) => reader.readEntries(resolve));
            if (entries.length > 0) {
              for (const entry of entries) {
                await traverseDirectory(entry);
              }
              await readEntries();
            }
          };
          await readEntries();
        }
      };

      const promises = Array.from(items).map((item) => {
        const entry = item.webkitGetAsEntry();
        if (entry) return traverseDirectory(entry);
        return null;
      });

      Promise.all(promises).then(() => {
        if (droppedFiles.length > 0) addFilesToList(droppedFiles);
      });
    } else {
      addFilesToList(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target && target.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    setFiles((prev) => {
      const oldIdx = prev.findIndex((f) => f.id === active.id);
      const newIdx = prev.findIndex((f) => f.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    const uploadedPanels: { r2Key: string; caption: string; sceneId: number | null }[] = [];
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const target = files[i];
      if (target.status === "success") {
        uploadedPanels.push({
          r2Key: target.previewUrl, // We stash successful key in previewUrl or somewhere else
          caption: target.filename,
          sceneId: selectedSceneId === "none" ? null : parseInt(selectedSceneId, 10),
        });
        continue;
      }

      setFiles((prev) =>
        prev.map((f) => (f.id === target.id ? { ...f, status: "uploading", progress: 10 } : f))
      );

      try {
        const isHeic = target.filename.toLowerCase().endsWith(".heic") || target.filename.toLowerCase().endsWith(".heif");
        let r2Key = "";

        if (isHeic) {
          // Upload to HEIC server-side conversion endpoint
          const formData = new FormData();
          formData.append("file", target.file);

          const token = localStorage.getItem("token") || "";
          const response = await fetch("/api/uploads/convert-heic", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
            },
            body: formData,
          });

          if (!response.ok) throw new Error("HEIC conversion or upload failed");
          const result = await response.json();
          r2Key = result.key;
        } else {
          // Get presigned URL and direct upload to R2
          const presignRes = await apiRequest("POST", "/api/uploads/presign", {
            filename: target.filename,
            contentType: target.file.type || "image/png",
          });

          if (!presignRes.ok) throw new Error("Failed to get presigned upload URL");
          const { url, key, headers } = await presignRes.json();

          // Direct upload to R2
          const uploadResponse = await fetch(url, {
            method: "PUT",
            headers: headers || {},
            body: target.file,
          });

          if (!uploadResponse.ok) throw new Error("Cloud storage upload failed");
          r2Key = key;
        }

        setFiles((prev) =>
          prev.map((f) => (f.id === target.id ? { ...f, status: "success", progress: 100 } : f))
        );

        uploadedPanels.push({
          r2Key,
          caption: target.filename,
          sceneId: selectedSceneId === "none" ? null : parseInt(selectedSceneId, 10),
        });
        successCount++;
      } catch (err: any) {
        console.error(err);
        setFiles((prev) =>
          prev.map((f) => (f.id === target.id ? { ...f, status: "error", error: err.message || "Upload failed" } : f))
        );
      }
    }

    if (uploadedPanels.length > 0) {
      try {
        // Save panels transactionally in the DB
        const res = await apiRequest("POST", `/api/storyboards/${storyboardId}/panels/bulk`, {
          panels: uploadedPanels,
        });

        if (res.ok) {
          toast({
            title: "Import complete",
            description: `Successfully imported ${successCount} storyboard panels.`,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storyboards"] });
          onSuccess();
          setOpen(false);
          setFiles([]);
        } else {
          throw new Error("Bulk registration failed");
        }
      } catch (err: any) {
        toast({
          title: "Registration failed",
          description: "Images uploaded but database registration failed. Please try again.",
          variant: "destructive",
        });
      }
    }

    setUploading(false);
  };

  const resetDialog = () => {
    setFiles([]);
    setSelectedSceneId("none");
    setUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetDialog(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-bulk-import-panels">
          <Grid size={14} className="mr-1.5" /> Bulk import panels
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle>Bulk Import Storyboard Panels</DialogTitle>
        </DialogHeader>

        {files.length === 0 ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="flex-1 min-h-[300px] border-2 border-dashed border-card-border rounded-xl flex flex-col items-center justify-center p-10 text-center hover:bg-muted/10 transition-colors duration-200"
          >
            <div className="h-14 w-14 rounded-full bg-accent/30 flex items-center justify-center mb-4 text-accent-foreground">
              <Upload size={24} />
            </div>
            <h3 className="font-display font-semibold text-lg mb-1.5">Drag & drop files or folder</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Drop a folder or multiple files here. Supports PNG, JPG, WebP, and HEIC formats. Natural numbering is preserved.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => fileInputRef.current?.click()} variant="outline">Select Files</Button>
              <Button onClick={() => folderInputRef.current?.click()} variant="outline">Select Folder</Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files && addFilesToList(e.target.files)}
            />
            <input
              ref={folderInputRef}
              type="file"
              {...({
                webkitdirectory: "",
                directory: "",
              } as any)}
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFilesToList(e.target.files)}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0 py-4 gap-4">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{files.length} panels detected</span>
                <span className="text-xs text-muted-foreground">• Drag to reorder if needed</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Attach to scene:</span>
                <Select value={selectedSceneId} onValueChange={setSelectedSceneId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="No Scene" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Scene</SelectItem>
                    {scenes?.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        Scene <span className="font-mono">{s.number}</span>: {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-card-border rounded-xl p-4 bg-muted/5">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={files.map((f) => f.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {files.map((file) => (
                      <SortablePreviewItem
                        key={file.id}
                        panel={file}
                        onRemove={() => removeFile(file.id)}
                        disabled={uploading}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 border-t border-card-border">
          {files.length > 0 && (
            <div className="flex-1 flex flex-col justify-center max-w-full sm:max-w-md">
              {uploading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Uploading and processing...</span>
                  </div>
                  <Progress value={Math.round((files.filter((f) => f.status === "success").length / files.length) * 100)} />
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={uploading}>Cancel</Button>
            {files.length > 0 && (
              <Button onClick={handleUpload} disabled={uploading} className="btn-sky-halo">
                {uploading ? (
                  <>
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  "Commit Import"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortablePreviewItem({ panel, onRemove, disabled }: { panel: PendingPanel; onRemove: () => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: panel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : undefined,
  };

  const isHeic = panel.filename.toLowerCase().endsWith(".heic") || panel.filename.toLowerCase().endsWith(".heif");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group aspect-[16/10] bg-muted/20 border border-card-border rounded-lg overflow-hidden flex flex-col justify-between ${
        disabled ? "" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div {...attributes} {...listeners} className="absolute inset-0 z-0 flex items-center justify-center">
        {isHeic ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground p-2">
            <ImageIcon size={22} className="opacity-50 mb-1" />
            <span className="text-[9px] font-mono select-none">HEIC Image</span>
          </div>
        ) : (
          <img src={panel.previewUrl} alt={panel.filename} className="w-full h-full object-cover select-none pointer-events-none" />
        )}
      </div>

      {/* Top overlay buttons */}
      <div className="absolute top-1 right-1 z-10 flex gap-1">
        {!disabled && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Bottom overlay filename */}
      <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 text-[9px] text-white font-mono truncate select-none">
        {panel.filename}
      </div>

      {/* Upload overlays */}
      {panel.status === "uploading" && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
          <Loader2 size={16} className="animate-spin text-white" />
        </div>
      )}
      {panel.status === "success" && (
        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center z-10 select-none">
          <span className="text-[10px] bg-green-600 text-white font-semibold px-1.5 py-0.5 rounded shadow">OK</span>
        </div>
      )}
      {panel.status === "error" && (
        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center z-10 select-none" title={panel.error}>
          <span className="text-[10px] bg-red-600 text-white font-semibold px-1.5 py-0.5 rounded shadow">Fail</span>
        </div>
      )}
    </div>
  );
}
