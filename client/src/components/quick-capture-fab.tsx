// v4 Quick capture floating action button
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Zap } from "lucide-react";

export function QuickCaptureFAB() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const { toast } = useToast();

  const save = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/inbox", { body, tags: tags.join(",") })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      setOpen(false);
      setBody(""); setTagInput(""); setTags([]);
      toast({ title: "✓ Idea captured" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full glass-button flex items-center justify-center shadow-lg ring-2 ring-primary/20 hover:ring-primary/40 transition-all active:scale-95"
          data-testid="button-quick-capture-fab"
          aria-label="Quick capture"
        >
          <Plus size={20} className="text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80 p-4 glass" sideOffset={8}>
        <div className="mb-2 flex items-center gap-2 font-semibold text-sm">
          <Zap size={14} className="text-primary" /> Quick capture
        </div>
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Capture an idea…"
            rows={3}
            className="text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (body.trim()) save.mutate();
              }
            }}
            data-testid="textarea-quick-capture"
            autoFocus
          />
          <div className="flex gap-1.5">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="Tag… (Enter to add)"
              className="text-xs h-7 flex-1"
              data-testid="input-quick-capture-tag"
            />
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1 text-xs h-5 px-1.5">
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-destructive">
                    <X size={9} />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex justify-between items-center pt-1">
            <span className="text-[10px] text-muted-foreground">⌘+Enter to save</span>
            <Button
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => save.mutate()}
              disabled={!body.trim() || save.isPending}
              data-testid="button-quick-capture-save"
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
