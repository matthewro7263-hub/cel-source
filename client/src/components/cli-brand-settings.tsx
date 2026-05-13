import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";
import { Upload, X } from "lucide-react";

// Local settings-section wrapper to avoid cross-page imports.

function BrandSettingsSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/20 font-display font-semibold">{title}</div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function CliBrandSettings({ project }: { project: Project }) {
  const { toast } = useToast();
  
  // Cast to any to access dynamic properties or rely on the schema
  const proj = project as any;
  const [brandLogo, setBrandLogo] = useState(proj.cli_brandLogo || "");
  const [brandColor, setBrandColor] = useState(proj.cli_brandColor || "#9DD0FF");
  const [brandWelcome, setBrandWelcome] = useState(proj.cli_brandWelcome || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patch = useMutation({
    mutationFn: async (data: any) => (await apiRequest("PATCH", `/api/projects/${project.id}`, data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      toast({ title: "Brand settings saved" });
    },
    onError: (e: any) => {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    }
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 500KB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setBrandLogo(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    setBrandLogo("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <BrandSettingsSection title="Brand (Client Portal)">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Brand Logo (max 500KB)</Label>
          <div className="flex items-center gap-4">
            {brandLogo ? (
              <div className="relative group rounded border bg-muted/30 p-2 w-32 h-16 flex items-center justify-center">
                <img src={brandLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
                <button 
                  onClick={handleClearLogo}
                  className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="rounded border border-dashed bg-muted/10 p-2 w-32 h-16 flex items-center justify-center text-xs text-muted-foreground">
                No logo
              </div>
            )}
            <div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleLogoChange}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} className="mr-2" /> Upload Logo
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Brand Color</Label>
          <div className="flex items-center gap-2">
            <input 
              type="color" 
              value={brandColor} 
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            />
            <Input 
              value={brandColor} 
              onChange={(e) => setBrandColor(e.target.value)} 
              className="w-24 font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Welcome Message</Label>
          <Textarea 
            value={brandWelcome} 
            onChange={(e) => setBrandWelcome(e.target.value)} 
            placeholder="Welcome to your client portal..."
            rows={2}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button 
            onClick={() => patch.mutate({ 
              cli_brandLogo: brandLogo, 
              cli_brandColor: brandColor, 
              cli_brandWelcome: brandWelcome 
            })} 
            disabled={patch.isPending}
            className="bg-[#9DD0FF] hover:bg-[#AED9FF] text-black"
          >
            Save Brand Settings
          </Button>
        </div>
      </div>
    </BrandSettingsSection>
  );
}