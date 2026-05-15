import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText, AlertCircle } from "lucide-react";
import { apiRequest, queryClient, getAuthToken } from "@/lib/queryClient";

interface ScriptUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  onUploaded?: (scriptId: number) => void;
}

export function ScriptUploadDialog({ open, onOpenChange, projectId, onUploaded }: ScriptUploadDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  const allowedExtensions = [".pdf", ".docx", ".txt", ".md", ".markdown"];
  const allowedMimes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
  ];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      toast({
        title: "Invalid file type",
        description: `Only ${allowedExtensions.join(", ")} files are allowed.`,
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB.",
        variant: "destructive",
      });
      return;
    }

    setFileName(file.name);
    await uploadScript(file);
  };

  const uploadScript = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/projects/${projectId}/scripts/upload`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Upload failed");
      }

      const script = await res.json();
      
      // Invalidate queries to refresh script list
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "scripts"] });
      onUploaded?.(script.id);
      
      toast({
        title: "Script uploaded",
        description: `"${file.name}" has been processed and added to your scripts.`,
      });

      setFileName("");
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Failed to upload script",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-background/95 backdrop-blur-xl">
        <div className="bg-primary/5 p-8 flex flex-col items-center text-center border-b border-border/20">
          <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
            <Upload size={32} />
          </div>
          <DialogTitle className="font-display text-2xl font-bold">Import Script</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Drag and drop your script file or click to browse.
          </DialogDescription>
        </div>

        <div className="p-8">
          <div 
            onClick={() => !uploading && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/50 hover:bg-primary/5 border-border/30'}`}
          >
            {uploading ? (
              <>
                <Loader2 size={24} className="animate-spin text-primary mb-2" />
                <span className="text-sm font-medium">Processing "{fileName}"...</span>
              </>
            ) : (
              <>
                <FileText size={24} className="text-muted-foreground mb-2" />
                <span className="text-sm font-medium">
                  {fileName || "Click to select a file"}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1 text-center">
                  PDF, DOCX, TXT, MD (Max 10MB)
                </span>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept={allowedMimes.join(",")}
              onChange={handleFileSelect}
            />
          </div>

          <div className="mt-6 flex items-start gap-3 bg-muted/30 p-4 rounded-xl">
            <AlertCircle size={16} className="text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              We'll use AI to analyze the structure of your script and prepare it for storyboarding.
              Large files may take a few seconds to process.
            </p>
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border/20 flex sm:justify-center">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={uploading} className="rounded-full">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
