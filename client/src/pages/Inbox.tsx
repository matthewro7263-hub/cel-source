// v4 Inbox page — quick-captured ideas
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Inbox, Plus, Trash2, MoveRight, X } from "lucide-react";
import type { InboxItem, Project } from "@shared/schema";

export default function InboxPage() {
  const { data: items, isLoading } = useQuery<InboxItem[]>({ queryKey: ["/api/inbox"] });
  const { data: projects } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { toast } = useToast();
  const [filterTag, setFilterTag] = useState<string>("");

  const delMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/inbox/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/inbox"] }),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, projectId }: { id: number; projectId: number }) =>
      (await apiRequest("PATCH", `/api/inbox/${id}`, { projectId })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      toast({ title: "Moved to project" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (item: InboxItem) => {
      if (!item.projectId) throw new Error("Assign to a project first");
      const scene = await (await apiRequest("POST", `/api/projects/${item.projectId}/scenes`, {
        title: item.body.slice(0, 80),
        description: item.body,
        number: "New",
      })).json();
      await apiRequest("DELETE", `/api/inbox/${item.id}`);
      return scene;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      toast({ title: "Converted to scene" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const allTags = Array.from(new Set(
    items?.flatMap((i) => i.tags ? i.tags.split(",").map((t) => t.trim()).filter(Boolean) : []) ?? []
  ));

  const filtered = items?.filter((i) => {
    if (!filterTag) return true;
    return i.tags && i.tags.split(",").map((t) => t.trim()).includes(filterTag);
  });

  if (isLoading) {
    return <div className="px-6 py-8 max-w-3xl mx-auto"><div className="h-64 bg-muted rounded animate-pulse" /></div>;
  }

  return (
    <div className="px-6 lg:px-10 py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight mb-1" data-testid="heading-inbox">Inbox</h1>
          <p className="text-sm text-muted-foreground">{items?.length ?? 0} captured ideas</p>
        </div>
        <AddInboxItemDialog />
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          <Button
            variant={filterTag === "" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setFilterTag("")}
          >All</Button>
          {allTags.map((t) => (
            <Button
              key={t}
              variant={filterTag === t ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setFilterTag(t === filterTag ? "" : t)}
            >{t}</Button>
          ))}
        </div>
      )}

      {(!filtered || filtered.length === 0) ? (
        <div className="text-center py-16 text-muted-foreground">
          <Inbox size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No ideas captured yet. Press the + button to capture one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <InboxCard
              key={item.id}
              item={item}
              projects={projects ?? []}
              onDelete={() => delMutation.mutate(item.id)}
              onMove={(pid) => moveMutation.mutate({ id: item.id, projectId: pid })}
              onConvert={() => convertMutation.mutate(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InboxCard({
  item, projects, onDelete, onMove, onConvert,
}: {
  item: InboxItem;
  projects: Project[];
  onDelete: () => void;
  onMove: (projectId: number) => void;
  onConvert: () => void;
}) {
  const tags = item.tags ? item.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const assignedProject = item.projectId ? projects.find((p) => p.id === item.projectId) : null;
  const sketchImage = (item as any).kind === "sketch" ? (item as any).imageDataUrl : null;

  return (
    <div className="rounded-xl border border-card-border bg-card p-4 group" data-testid={`inbox-item-${item.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {sketchImage ? (
            <div className="space-y-3">
              <img src={sketchImage} alt={item.body || "Scratchpad sketch"} className="max-h-80 w-full rounded-lg border object-contain bg-white" />
              {item.body && <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.body}</p>}
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.body}</p>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px] h-4 px-1.5">{t}</Badge>
              ))}
            </div>
          )}
          {assignedProject && (
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: assignedProject.coverColor }} />
              {assignedProject.title}
            </div>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {item.projectId && (
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={onConvert} data-testid={`button-convert-inbox-${item.id}`}>
              <MoveRight size={12} className="mr-1" />Scene
            </Button>
          )}
          <Select onValueChange={(v) => onMove(parseInt(v))}>
            <SelectTrigger className="h-7 w-auto text-xs border-none shadow-none px-2" data-testid={`button-move-inbox-${item.id}`}>
              Move
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete} data-testid={`button-delete-inbox-${item.id}`}>
            <Trash2 size={13} />
          </Button>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground mt-2">{new Date(item.createdAt).toLocaleString()}</div>
    </div>
  );
}

function AddInboxItemDialog() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const { toast } = useToast();

  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/inbox", {
      body,
      tags: tags.join(","),
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      setOpen(false);
      setBody(""); setTagInput(""); setTags([]);
      toast({ title: "Idea captured!" });
    },
  });

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-inbox-item">
          <Plus size={14} className="mr-1.5" />Capture idea
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Capture an idea</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's on your mind?"
            rows={4}
            data-testid="textarea-inbox-body"
          />
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="Add tag… (press Enter)"
              className="text-sm h-8"
              data-testid="input-inbox-tag"
            />
            <Button size="sm" variant="outline" onClick={addTag} className="h-8">Add</Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-destructive">
                    <X size={10} />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!body.trim() || create.isPending} data-testid="button-save-inbox-item">
            {create.isPending ? "Saving…" : "Save idea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
