import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

import { getAuthToken } from "@/lib/queryClient";

export default function BakSpriteSheetPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [selectedPanels, setSelectedPanels] = useState<number[]>([]);
  const [potPadding, setPotPadding] = useState(false);

  // We fetch storyboards to get all panels.
  const { data: storyboards = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/projects/${id}/storyboards`],
  });

  const handleExport = async () => {
    if (selectedPanels.length === 0) {
      toast({ title: "Select at least one panel", variant: "destructive" });
      return;
    }

    try {
      const token = getAuthToken();
      const res = await fetch(`/api/projects/${id}/spritesheet`, {
         method: 'POST',
         headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({ panelIds: selectedPanels, potPadding })
      });

      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spritesheet.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Spritesheet exported successfully" });

    } catch (e) {
      toast({ title: "Failed to export spritesheet", variant: "destructive" });
    }
  };

  const togglePanel = (panelId: number) => {
    setSelectedPanels(prev => 
      prev.includes(panelId) ? prev.filter(id => id !== panelId) : [...prev, panelId]
    );
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${id}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-display font-bold">Sprite-Sheet Packer</h1>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={potPadding} onChange={e => setPotPadding(e.target.checked)} className="rounded" />
            Power-of-Two Padding
          </label>
          <Button onClick={handleExport} className="bg-[#9DD0FF] hover:bg-[#AED9FF] text-black">
            <Download className="w-4 h-4 mr-2" />
            Export Spritesheet
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {storyboards?.map((sb: any) => (
          <Card key={sb.id}>
            <CardHeader><CardTitle>{sb.title}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {sb.panels?.map((p: any) => {
                  const isSelected = selectedPanels.includes(p.id);
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => togglePanel(p.id)}
                      className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${isSelected ? 'border-[#9DD0FF] ring-2 ring-[#9DD0FF]/50' : 'border-transparent hover:border-muted-foreground/30'}`}
                    >
                      <div className="aspect-video bg-muted flex items-center justify-center relative">
                        {p.imageData ? (
                          <img
                            src={p.imageData}
                            alt={p.caption || p.dialogue || `Sprite panel ${p.orderIdx + 1}`}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs">No Image</span>
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-[#9DD0FF] text-black rounded-full p-1">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
