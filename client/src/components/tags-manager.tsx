// v4 Tags management and inline tag selector
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tag, Plus, Trash2, X, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Tag as TagType, TagAssignment } from "@shared/schema";

// ===== Tags Settings Panel (for project Settings tab) =====
export function TagsSettingsPanel() {
  const { data: tags = [] } = useQuery<TagType[]>({ queryKey: ["/api/tags"] });
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6E4FE8");
  const { toast } = useToast();

  const createTag = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/tags", { name: newName, color: newColor })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setNewName(""); setNewColor("#6E4FE8");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteTag = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/tags/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tags"] }),
  });

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-1.5"><Tag size={14} />Tags</h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <Badge
            key={t.id}
            style={{ backgroundColor: t.color + "22", color: t.color, borderColor: t.color + "44" }}
            className="gap-1.5 border"
            data-testid={`tag-chip-${t.id}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
            {t.name}
            <button
              onClick={() => deleteTag.mutate(t.id)}
              className="hover:opacity-70"
              aria-label="Remove tag"
              data-testid={`button-delete-tag-${t.id}`}
            >
              <X size={10} />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-border"
          data-testid="input-tag-color"
        />
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createTag.mutate(); }}
          placeholder="Tag name…"
          className="text-sm h-8 flex-1"
          data-testid="input-tag-name"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => createTag.mutate()}
          disabled={!newName.trim() || createTag.isPending}
          data-testid="button-create-tag"
        >
          <Plus size={13} />
        </Button>
      </div>
    </div>
  );
}

// ===== Inline Tag Selector (for scene/asset/inbox detail views) =====
interface InlineTagSelectorProps {
  entityKind: "scene" | "asset" | "panel" | "inboxItem";
  entityId: number;
}

export function InlineTagSelector({ entityKind, entityId }: InlineTagSelectorProps) {
  const { data: allTags = [] } = useQuery<TagType[]>({ queryKey: ["/api/tags"] });
  const { data: assignments = [] } = useQuery<TagAssignment[]>({
    queryKey: ["/api/tag-assignments", entityKind, entityId],
    queryFn: async () => (await apiRequest("GET", `/api/tag-assignments?kind=${entityKind}&entityId=${entityId}`)).json(),
  });
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const { toast } = useToast();

  const assignedTagIds = assignments.map((a) => a.tagId);
  const assignedTags = allTags.filter((t) => assignedTagIds.includes(t.id));

  const createTagMutation = useMutation({
    mutationFn: async (name: string) => {
      const tag = await (await apiRequest("POST", "/api/tags", { name, color: "#6E4FE8" })).json();
      return (await apiRequest("POST", "/api/tag-assignments", { tagId: tag.id, entityKind, entityId })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tag-assignments", entityKind, entityId] });
      setNewTagName("");
    },
  });

  const toggleTag = useMutation({
    mutationFn: async (tagId: number) => {
      const existing = assignments.find((a) => a.tagId === tagId);
      if (existing) {
        return (await apiRequest("DELETE", `/api/tag-assignments/${existing.id}`)).json();
      } else {
        return (await apiRequest("POST", "/api/tag-assignments", { tagId, entityKind, entityId })).json();
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tag-assignments", entityKind, entityId] }),
  });

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {assignedTags.map((t) => (
        <Badge
          key={t.id}
          style={{ backgroundColor: t.color + "22", color: t.color, borderColor: t.color + "44" }}
          className="gap-1 border text-xs h-5 px-1.5"
        >
          {t.name}
          <button onClick={() => toggleTag.mutate(t.id)} className="hover:opacity-70" aria-label="Remove tag"><X size={8} /></button>
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-5 w-5 p-0 rounded-full" data-testid={`button-add-tag-${entityKind}-${entityId}`}>
            <Tag size={11} className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2">
          <div className="space-y-1.5">
            {allTags.map((t) => (
              <button
                key={t.id}
                className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-accent text-sm"
                onClick={() => toggleTag.mutate(t.id)}
                data-testid={`tag-option-${t.id}`}
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                <span className="flex-1 text-left">{t.name}</span>
                {assignedTagIds.includes(t.id) && <Check size={12} className="text-primary" />}
              </button>
            ))}
            <div className="border-t border-border pt-1.5">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newTagName.trim()) createTagMutation.mutate(newTagName); }}
                placeholder="Create new tag…"
                className="text-xs h-6"
                data-testid="input-new-inline-tag"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
