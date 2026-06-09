import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { apiRequest, queryClient, getAuthToken } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Image as ImageIcon, Plus, Trash2, Upload, Presentation, X, Pencil, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Storyboard, Panel, Scene } from "@shared/schema";
import { GlassButton } from "@/components/ui/glass-button";
import { StoryboardReviewer } from "@/components/storyboard-reviewer";
import { BulkImportDialog } from "@/components/bulk-panel-import-dialog";
import { SketchModal } from "@/components/storyboard-sketch";
import { PanelPinsOverlay, PinModeToggle, type PinData } from "@/components/panel-pins";

type StoryboardWithPanels = Storyboard & { panels: Panel[] };

function patchPanelInCache(projectId: number, panelId: number, patch: Partial<Panel>) {
  queryClient.setQueryData<StoryboardWithPanels[]>(
    queryKeys.storyboards(projectId),
    (old) => {
      if (!old) return old;
      return old.map((board) => ({
        ...board,
        panels: board.panels.map((p) => (p.id === panelId ? { ...p, ...patch } : p)),
      }));
    },
  );
}

function V4SketchButton({ storyboardId, projectId }: { storyboardId: number; projectId: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="button-sketch-panel">
        <Pencil size={14} className="mr-1.5" />Sketch
      </Button>
      {open && <SketchModal storyboardId={storyboardId} projectId={projectId} onClose={() => setOpen(false)} />}
    </>
  );
}

function V4PanelPinLayer({
  panelId,
  allPins,
  storyboardId,
}: {
  panelId: number;
  allPins: PinData[];
  storyboardId: number;
}) {
  const [pinMode, setPinMode] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-1">
      <PinModeToggle panelId={panelId} pinMode={pinMode} onToggle={() => setPinMode((v) => !v)} allPins={allPins} />
      {pinMode && (
        <PanelPinsOverlay panelId={panelId} pinMode={pinMode} allPins={allPins} storyboardId={storyboardId} />
      )}
    </div>
  );
}

function EmptyTabState({
  icon,
  title,
  body,
  ctaLabel,
  onCta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="glass rounded-xl py-12 px-6 flex flex-col items-center text-center">
      <div className="mb-4 text-muted-foreground">{icon}</div>
      <h3 className="font-display font-semibold mb-1.5 text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-sm">{body}</p>
      <Button onClick={onCta}>{ctaLabel}</Button>
    </div>
  );
}

export default function StoryboardsTab({ projectId }: { projectId: number }) {
  const { data: boards } = useQuery<StoryboardWithPanels[]>({
    queryKey: queryKeys.storyboards(projectId),
  });
  const [activeId, setActiveId] = useState<number | null>(null);
  const [deepLinkPanelId, setDeepLinkPanelId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const panelParam = params.get("panel");
    if (panelParam) {
      const panelId = parseInt(panelParam, 10);
      if (!isNaN(panelId)) setDeepLinkPanelId(panelId);
    }
  }, []);

  useEffect(() => {
    if (deepLinkPanelId && boards) {
      const board = boards.find((b) => b.panels.some((p) => p.id === deepLinkPanelId));
      if (board) setActiveId(board.id);
    }
  }, [boards, deepLinkPanelId]);

  useEffect(() => {
    if (activeId === null && boards && boards.length > 0) setActiveId(boards[0].id);
  }, [boards, activeId]);

  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/projects/${projectId}/storyboards`, { title: "New storyboard" })).json(),
    onSuccess: (sb: Storyboard) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storyboards(projectId) });
      setActiveId(sb.id);
    },
  });
  const del = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/projects/${projectId}/storyboards/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storyboards(projectId) });
      setActiveId(null);
    },
  });

  if (!boards || boards.length === 0) {
    return (
      <EmptyTabState
        icon={<ImageIcon size={20} />}
        title="No storyboards yet"
        body="Upload reference frames, sketch boards, or shot blocks. Drag to reorder."
        ctaLabel="New storyboard"
        onCta={() => create.mutate()}
      />
    );
  }

  const current = boards.find((b) => b.id === activeId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveId(b.id)}
              className={`text-sm px-3 py-1.5 rounded-md border whitespace-nowrap hover-elevate ${
                activeId === b.id ? "bg-accent border-foreground/20 font-medium" : "border-border"
              }`}
              data-testid={`button-storyboard-${b.id}`}
            >
              {b.title}{" "}
              <span className="text-muted-foreground text-xs">({b.panels.length})</span>
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => create.mutate()} data-testid="button-new-storyboard">
          <Plus size={14} className="mr-1.5" />New storyboard
        </Button>
      </div>

      {current && (
        <StoryboardView
          board={current}
          projectId={projectId}
          onDelete={() => del.mutate(current.id)}
          initialSelectedPanelId={deepLinkPanelId}
        />
      )}
    </div>
  );
}

function StoryboardView({
  board,
  projectId,
  onDelete,
  initialSelectedPanelId,
}: {
  board: StoryboardWithPanels;
  projectId: number;
  onDelete: () => void;
  initialSelectedPanelId?: number | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [panels, setPanels] = useState<Panel[]>(board.panels);
  const [reviewing, setReviewing] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(initialSelectedPanelId ?? null);
  const [sceneFilter, setSceneFilter] = useState<string>("all");
  const [columnCount, setColumnCount] = useState(3);
  const { toast } = useToast();

  const { data: scenes = [] } = useQuery<Scene[]>({
    queryKey: queryKeys.scenes(projectId),
  });

  const { data: allPins = [] } = useQuery<PinData[]>({
    queryKey: queryKeys.storyboardPins(board.id),
    queryFn: async () => (await apiRequest("GET", `/api/storyboards/${board.id}/pins`)).json(),
  });

  const filteredPanels = sceneFilter === "all"
    ? panels
    : sceneFilter === "none"
      ? panels.filter((p) => !p.sceneId)
      : panels.filter((p) => p.sceneId === parseInt(sceneFilter, 10));

  const selectedPanel = panels.find((p) => p.id === selectedPanelId);
  const useVirtualGrid = filteredPanels.length > 20;

  useEffect(() => { setPanels(board.panels); }, [board.id, board.panels.length]);

  useEffect(() => {
    if (initialSelectedPanelId && board.panels.some((p) => p.id === initialSelectedPanelId)) {
      setSelectedPanelId(initialSelectedPanelId);
    }
  }, [initialSelectedPanelId, board.panels]);

  useEffect(() => {
    const updateColumns = () => {
      const width = gridScrollRef.current?.clientWidth ?? window.innerWidth;
      if (selectedPanelId) {
        setColumnCount(width >= 640 ? 2 : 1);
      } else {
        setColumnCount(width >= 1024 ? 3 : width >= 640 ? 2 : 1);
      }
    };
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, [selectedPanelId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const upload = useMutation({
    mutationFn: async (data: { r2Key: string; caption: string }) => {
      const r = await apiRequest("POST", `/api/storyboards/${board.id}/panels`, data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storyboards(projectId) });
    },
    onError: (err: any) => toast({ title: "Upload failed", description: String(err.message || err), variant: "destructive" }),
  });

  const reorder = useMutation({
    mutationFn: async (newOrder: Panel[]) => {
      await apiRequest("POST", `/api/storyboards/${board.id}/panels/reorder`, {
        orderedIds: newOrder.map((p) => p.id),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storyboards(projectId) }),
  });

  const delPanel = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/panels/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storyboards(projectId) }),
  });

  const editPanel = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Panel> }) =>
      (await apiRequest("PATCH", `/api/panels/${id}`, patch)).json() as Promise<Panel>,
    onMutate: async ({ id, patch }) => {
      const isCaptionOnly = Object.keys(patch).length === 1 && "caption" in patch;
      if (!isCaptionOnly) return {};
      const previous = queryClient.getQueryData<StoryboardWithPanels[]>(queryKeys.storyboards(projectId));
      patchPanelInCache(projectId, id, patch);
      return { previous };
    },
    onError: (_err, { id, patch }, context) => {
      const isCaptionOnly = Object.keys(patch).length === 1 && "caption" in patch;
      if (isCaptionOnly && context?.previous) {
        queryClient.setQueryData(queryKeys.storyboards(projectId), context.previous);
      }
    },
    onSuccess: (updated, { id, patch }) => {
      const isCaptionOnly = Object.keys(patch).length === 1 && "caption" in patch;
      if (isCaptionOnly) {
        patchPanelInCache(projectId, id, { caption: updated.caption });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.storyboards(projectId) });
      }
    },
  });

  const handleCaptionEdit = useCallback((panelId: number, caption: string) => {
    editPanel.mutate({ id: panelId, patch: { caption } });
  }, [editPanel]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast({ title: "File too large", description: `${file.name} exceeds 10MB.`, variant: "destructive" });
          continue;
        }

        const isHeic = file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");
        let r2Key = "";

        if (isHeic) {
          const formData = new FormData();
          formData.append("file", file);
          const token = getAuthToken() || "";
          const response = await fetch("/api/uploads/convert-heic", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (!response.ok) throw new Error("HEIC conversion or upload failed");
          const result = await response.json();
          r2Key = result.key;
        } else {
          const presignRes = await apiRequest("POST", "/api/uploads/presign", {
            filename: file.name,
            contentType: file.type || "image/png",
          });
          if (!presignRes.ok) throw new Error("Failed to get presigned upload URL");
          const { url, key, headers } = await presignRes.json();

          const uploadResponse = await fetch(url, {
            method: "PUT",
            headers: headers || {},
            body: file,
          });
          if (!uploadResponse.ok) throw new Error("Cloud storage upload failed");
          r2Key = key;
        }

        await upload.mutateAsync({ r2Key, caption: file.name });
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: String(err.message || err), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = panels.findIndex((p) => p.id === active.id);
    const newIdx = panels.findIndex((p) => p.id === over.id);
    const next = arrayMove(panels, oldIdx, newIdx);
    setPanels(next);
    reorder.mutate(next);
  };

  const rowCount = Math.ceil(filteredPanels.length / columnCount);
  const rowVirtualizer = useVirtualizer({
    count: useVirtualGrid ? rowCount : 0,
    getScrollElement: () => gridScrollRef.current,
    estimateSize: () => 300,
    overscan: 2,
  });

  const renderPanel = (p: Panel, i: number) => (
    <SortablePanel
      key={p.id}
      panel={p}
      index={i}
      allPins={allPins}
      storyboardId={board.id}
      onDelete={() => {
        delPanel.mutate(p.id);
        if (selectedPanelId === p.id) setSelectedPanelId(null);
      }}
      onEdit={(patch) => editPanel.mutate({ id: p.id, patch })}
      onCaptionEdit={(caption) => handleCaptionEdit(p.id, caption)}
      onClick={() => setSelectedPanelId(p.id)}
      isSelected={selectedPanelId === p.id}
    />
  );

  const panelGrid = (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={filteredPanels.map((p) => p.id)} strategy={rectSortingStrategy}>
        {useVirtualGrid ? (
          <div
            ref={gridScrollRef}
            className="max-h-[70vh] overflow-y-auto pr-1"
          >
            <div
              style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const startIdx = virtualRow.index * columnCount;
                const rowPanels = filteredPanels.slice(startIdx, startIdx + columnCount);
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="grid gap-4 pb-4"
                    data-virtual-row={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                  >
                    <div
                      className="grid gap-4"
                      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
                    >
                      {rowPanels.map((p, offset) => renderPanel(p, startIdx + offset))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            ref={gridScrollRef}
            className={`grid gap-4 ${selectedPanelId ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}
          >
            {filteredPanels.map((p, i) => renderPanel(p, i))}
          </div>
        )}
      </SortableContext>
    </DndContext>
  );

  return (
    <>
      {reviewing && panels.length > 0 && (
        <StoryboardReviewer panels={panels} onClose={() => setReviewing(false)} />
      )}
      <div className="rounded-xl border border-card-border bg-card p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="font-display font-semibold">{board.title}</h3>
          <div className="flex gap-2 items-center flex-wrap">
            {panels.length > 0 && (
              <Select value={sceneFilter} onValueChange={setSceneFilter}>
                <SelectTrigger className="h-8 w-[180px] text-xs" data-testid="select-scene-filter">
                  <SelectValue placeholder="All scenes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All scenes</SelectItem>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {scenes.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      Scene {s.number}: {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {panels.length > 0 && (
              <GlassButton
                variant="primary"
                size="sm"
                onClick={() => setReviewing(true)}
                data-testid="button-review-storyboard"
              >
                <Presentation size={13} className="mr-1" /> Review
              </GlassButton>
            )}
            <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} data-testid="input-upload-panel" />
            <V4SketchButton storyboardId={board.id} projectId={projectId} />
            <BulkImportDialog storyboardId={board.id} projectId={projectId} onSuccess={() => {}} />
            <Button
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              data-testid="button-upload-panels"
            >
              {uploading ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload size={14} className="mr-1.5" />
                  Upload panels
                </>
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive" data-testid="button-delete-storyboard">
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        {panels.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg py-12 text-center text-sm text-muted-foreground">
            No panels yet. Click <span className="font-medium text-foreground">Upload panels</span> to add images.
          </div>
        ) : (
          <div className="flex gap-4 items-start">
            <div className="flex-1 min-w-0">
              {panelGrid}
            </div>
            {selectedPanel && (
              <StoryboardInspector
                panel={selectedPanel}
                index={panels.findIndex((p) => p.id === selectedPanelId)}
                onClose={() => setSelectedPanelId(null)}
                onEdit={(patch) => editPanel.mutate({ id: selectedPanel.id, patch })}
                onCaptionEdit={(caption) => handleCaptionEdit(selectedPanel.id, caption)}
                onDelete={() => {
                  delPanel.mutate(selectedPanel.id);
                  setSelectedPanelId(null);
                }}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}

const SortablePanel = memo(function SortablePanel({
  panel,
  index,
  allPins,
  storyboardId,
  onDelete,
  onEdit,
  onCaptionEdit,
  onClick,
  isSelected,
}: {
  panel: Panel;
  index: number;
  allPins: PinData[];
  storyboardId: number;
  onDelete: () => void;
  onEdit: (patch: Partial<Panel>) => void;
  onCaptionEdit: (caption: string) => void;
  onClick: () => void;
  isSelected: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: panel.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [caption, setCaption] = useState(panel.caption || "");

  useEffect(() => {
    setCaption(panel.caption || "");
  }, [panel]);

  const panelImageUrl = panel.imageData || (panel.r2Key ? `/api/uploads/file?key=${encodeURIComponent(panel.r2Key)}` : "");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-background overflow-hidden group transition-all duration-150 ${
        isSelected ? "border-primary ring-1 ring-primary" : "border-border"
      }`}
      data-testid={`panel-${panel.id}`}
    >
      <div
        {...attributes}
        {...listeners}
        onClick={onClick}
        className="aspect-video bg-muted relative cursor-grab active:cursor-grabbing hover:brightness-95 transition-all duration-150"
      >
        <img
          src={panelImageUrl}
          alt={panel.caption || panel.dialogue || `Storyboard panel ${index + 1}`}
          className="w-full h-full object-cover select-none pointer-events-none"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute top-2 left-2 text-[10px] font-mono bg-background/90 px-1.5 py-0.5 rounded">
          #{String(index + 1).padStart(2, "0")}
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-1.5 right-1.5 h-7 w-7 bg-background/90 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive hover:text-white transition-all duration-150 shadow-sm"
          data-testid={`button-delete-panel-${panel.id}`}
        >
          <Trash2 size={13} />
        </Button>
      </div>
      <div className="p-3 space-y-2">
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== panel.caption && onCaptionEdit(caption)}
          className="text-xs h-8"
          placeholder="Caption…"
          data-testid={`input-caption-${panel.id}`}
        />
        {panel.dialogue && <div className="text-xs italic text-muted-foreground">"{panel.dialogue}"</div>}
        <V4PanelPinLayer panelId={panel.id} allPins={allPins} storyboardId={storyboardId} />
      </div>
    </div>
  );
});

function StoryboardInspector({
  panel,
  index,
  onClose,
  onEdit,
  onCaptionEdit,
  onDelete,
}: {
  panel: Panel;
  index: number;
  onClose: () => void;
  onEdit: (patch: Partial<Panel>) => void;
  onCaptionEdit: (caption: string) => void;
  onDelete: () => void;
}) {
  const [caption, setCaption] = useState(panel.caption || "");
  const [notes, setNotes] = useState(panel.notes || "");
  const [changeRequest, setChangeRequest] = useState(panel.changeRequest || "");
  const [frameCount, setFrameCount] = useState<string>(String(panel.frameCount ?? 24));
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCaption(panel.caption || "");
    setNotes(panel.notes || "");
    setChangeRequest(panel.changeRequest || "");
    setFrameCount(String(panel.frameCount ?? 24));
  }, [panel]);

  const handleReplaceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onEdit({ imageData: reader.result as string, r2Key: null });
    };
    reader.readAsDataURL(file);
  };

  const panelImageUrl = panel.imageData || (panel.r2Key ? `/api/uploads/file?key=${encodeURIComponent(panel.r2Key)}` : "");

  return (
    <div className="w-[320px] shrink-0 glass-strong rounded-2xl p-4 space-y-4 flex flex-col h-[calc(100vh-200px)] overflow-y-auto sticky top-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">
          Panel #<span className="font-mono">{String(index + 1).padStart(2, "0")}</span>
        </h4>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>

      <div className="space-y-4 flex-1">
        <div className="space-y-2">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Image</Label>
          <div className="aspect-video bg-muted border border-border rounded overflow-hidden relative">
            {panelImageUrl ? (
              <img src={panelImageUrl} alt={caption} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                No image data
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReplaceImage}
            />
            <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => replaceInputRef.current?.click()}>
              Replace image
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Caption</Label>
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => caption !== panel.caption && onCaptionEdit(caption)}
            placeholder="No caption..."
            className="text-xs h-8"
          />
        </div>

        {panel.dialogue && (
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dialogue</Label>
            <div className="text-xs italic text-muted-foreground p-2 bg-muted/30 rounded border border-border/50">
              "{panel.dialogue}"
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== panel.notes && onEdit({ notes })}
            rows={3}
            placeholder="Add notes..."
            className="text-xs resize-none"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
          <Select
            value={panel.status || "ROUGH"}
            onValueChange={(val) => onEdit({ status: val })}
          >
            <SelectTrigger className="text-xs h-8">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ROUGH">Rough</SelectItem>
              <SelectItem value="CLEAN">Clean</SelectItem>
              <SelectItem value="FINAL">Final</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Frame Count</Label>
          <Input
            type="number"
            value={frameCount}
            onChange={(e) => setFrameCount(e.target.value)}
            onBlur={() => {
              const val = parseInt(frameCount, 10);
              if (!isNaN(val) && val !== panel.frameCount) {
                onEdit({ frameCount: val });
              }
            }}
            placeholder="24"
            className="text-xs h-8 font-mono"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-amber-500">Change Request</Label>
          <Input
            value={changeRequest}
            onChange={(e) => setChangeRequest(e.target.value)}
            onBlur={() => changeRequest !== panel.changeRequest && onEdit({ changeRequest })}
            placeholder="Add a change request..."
            className="text-xs h-8 border-amber-200 focus-visible:ring-amber-500"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-border flex justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={onClose} className="text-xs h-8">
          Close
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete} className="text-xs h-8 px-2.5">
          <Trash2 size={13} className="mr-1" /> Delete Panel
        </Button>
      </div>
    </div>
  );
}