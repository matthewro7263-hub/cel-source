import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, UploadCloud, FileIcon, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function AssetRevisionTree({ assetId }: { assetId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: asset, isLoading: loadingAsset } = useQuery({ queryKey: [`/api/assets/${assetId}`] });
  const { data: versions = [] as any[], isLoading: loadingVersions } = useQuery<any[]>({ queryKey: [`/api/assets/${assetId}/lor_versions`] });

  const uploadVersion = useMutation({
    mutationFn: async (fileData: string) => {
      await apiRequest("POST", `/api/assets/${assetId}/lor_versions`, { fileData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assets/${assetId}/lor_versions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/assets/${assetId}`] });
      toast({ title: "New version uploaded" });
    }
  });

  const approveVersion = useMutation({
    mutationFn: async (versionId: number) => {
      await apiRequest("POST", `/api/assets/${assetId}/lor_versions/${versionId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assets/${assetId}/lor_versions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/assets/${assetId}`] });
      toast({ title: "Version approved" });
    }
  });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", variant: "destructive" });
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      uploadVersion.mutate(ev.target?.result as string, { onSettled: () => setUploading(false) });
    };
    reader.readAsDataURL(file);
  };

  if (loadingAsset || loadingVersions) return <div className="p-4 text-sm text-muted-foreground">Loading tree...</div>;

  return (
    <div className="mt-4 p-4 border rounded-lg bg-card/50">
      <div className="flex items-center justify-between mb-6">
        <h4 className="font-semibold text-sm">Revision History</h4>
        <div className="relative">
          <Input 
            type="file" 
            onChange={handleUpload} 
            disabled={uploading}
            className="absolute inset-0 opacity-0 cursor-pointer w-full" 
            title="Upload new version"
          />
          <Button size="sm" variant="outline" disabled={uploading}>
            <UploadCloud size={14} className="mr-2" />
            {uploading ? "Uploading..." : "Upload v" + ((versions[0]?.versionNum || 0) + 1)}
          </Button>
        </div>
      </div>

      {versions.length === 0 ? (
        <div className="text-center p-4 text-sm text-muted-foreground bg-muted/50 rounded flex flex-col items-center">
          <Info size={16} className="mb-2 opacity-50" />
          No alternate versions exist. The base asset is v1.
        </div>
      ) : (
        <div className="relative border-l-2 border-border ml-3 pl-6 space-y-6">
          {versions.map((v: any, index: number) => (
            <div key={v.id} className="relative">
              {/* Timeline node */}
              <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 bg-background ${v.approved ? "border-green-500" : "border-muted-foreground"}`} />
              
              <div className={`p-3 rounded border ${v.approved ? "bg-green-500/10 border-green-500/30" : "bg-background"}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold">v{v.versionNum}</span>
                      {v.approved && <Badge variant="secondary" className="bg-green-500 text-white hover:bg-green-600">Approved Default</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(v.uploadedAt).toLocaleString()}</div>
                  </div>
                  {!v.approved && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => approveVersion.mutate(v.id)}
                      className="text-xs h-7"
                    >
                      <Check size={12} className="mr-1" /> Set Approved
                    </Button>
                  )}
                </div>
                {/* Mini preview */}
                <div className="mt-3 bg-black/10 rounded overflow-hidden max-h-24 flex items-center justify-center">
                  {v.fileData.startsWith("data:image") ? (
                    <img src={v.fileData} className="max-h-24 object-contain" />
                  ) : (
                    <FileIcon className="text-muted-foreground opacity-50" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
