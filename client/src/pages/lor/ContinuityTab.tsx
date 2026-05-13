import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, Info, Check, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import ReactMarkdown from "react-markdown";

export default function ContinuityTab({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newFact, setNewFact] = useState({ category: "character", title: "", body: "", imageData: "" });

  const { data: facts = [] as any[], isLoading } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/lor_facts`],
  });

  const createFact = useMutation({
    mutationFn: async (fact: any) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/lor_facts`, fact);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/lor_facts`] });
      setAdding(false);
      setNewFact({ category: "character", title: "", body: "", imageData: "" });
    }
  });

  const deleteFact = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/lor_facts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/lor_facts`] });
    }
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast({ title: "File too large", description: "Limit is 500KB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewFact(prev => ({ ...prev, imageData: event.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const filteredFacts = facts.filter((f: any) => {
    if (filter !== "all" && f.category !== filter) return false;
    if (search && !f.title.toLowerCase().includes(search.toLowerCase()) && !f.body.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (isLoading) return <div className="text-muted-foreground p-8 text-center">Loading facts...</div>;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex-1 flex gap-2 w-full">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search lore..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="character">Characters</SelectItem>
              <SelectItem value="prop">Props</SelectItem>
              <SelectItem value="location">Locations</SelectItem>
              <SelectItem value="rule">Rules</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setAdding(true)} className="bg-[#9DD0FF] hover:bg-[#AED9FF] text-black">
          <Plus size={16} className="mr-2" /> Add Fact
        </Button>
      </div>

      {adding && (
        <div className="bg-card p-4 rounded-lg border shadow-sm space-y-4">
          <h3 className="font-medium text-lg">New Continuity Fact</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={newFact.category} onValueChange={v => setNewFact({...newFact, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="character">Character</SelectItem>
                    <SelectItem value="prop">Prop</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="rule">Rule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input value={newFact.title} onChange={e => setNewFact({...newFact, title: e.target.value})} placeholder="e.g. Floppy" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea 
                value={newFact.body} 
                onChange={e => setNewFact({...newFact, body: e.target.value})} 
                placeholder="Details, dimensions, facts..."
                className="h-[108px] resize-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reference Image (Optional, max 500KB)</label>
            <Input type="file" accept="image/*" onChange={handleImageUpload} />
            {newFact.imageData && <img src={newFact.imageData} alt="Preview" className="h-20 object-contain rounded border mt-2" />}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button 
              className="bg-[#9DD0FF] hover:bg-[#AED9FF] text-black"
              disabled={!newFact.title || createFact.isPending}
              onClick={() => createFact.mutate(newFact)}
            >
              Save Fact
            </Button>
          </div>
        </div>
      )}

      {filteredFacts.length === 0 ? (
        <div className="bg-card/50 border border-dashed rounded-lg p-12 text-center text-muted-foreground">
          <Info size={32} className="mx-auto mb-4 opacity-50" />
          <p>No continuity facts found.</p>
          <p className="text-sm mt-1">Keep track of character heights, prop locations, and show rules here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFacts.map((fact: any) => (
            <div key={fact.id} className="bg-card rounded-lg border shadow-sm overflow-hidden flex flex-col group">
              {fact.imageData && (
                <div className="h-32 bg-muted flex items-center justify-center border-b">
                  <img src={fact.imageData} alt={fact.title} className="h-full w-full object-cover" />
                </div>
              )}
              <div className="p-4 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-secondary text-secondary-foreground uppercase tracking-wider">
                    {fact.category}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                    onClick={() => {
                      if (confirm("Delete this fact?")) deleteFact.mutate(fact.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                <h3 className="font-semibold text-lg mb-2">{fact.title}</h3>
                <div className="text-sm prose-cel text-muted-foreground line-clamp-4">
                  <ReactMarkdown>{fact.body}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
