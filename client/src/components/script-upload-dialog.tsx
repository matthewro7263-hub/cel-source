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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload size={18} /> Upload Script
          </DialogTitle>
          <DialogDescription>
            Import your script from a document file. Supports PDF, DOCX, TXT, and Markdown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File info */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 flex gap-2 items-start">
            <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Supported formats:</p>
              <ul className="text-xs space-y-0.5">
                <li>• <strong>PDF</strong> - Text extracted from the document</li>
                <li>• <strong>DOCX</strong> - Word documents</li>
                <li>• <strong>TXT</strong> - Plain text</li>
                <li>• <strong>Markdown</strong> - MD files</li>
              </ul>
            </div>
          </div>

          {/* File selection area */}
          <div>
            <Label className="mb-2 block">Select file</Label>
            <input
              ref={fileRef}
              type="file"
              accept={allowedMimes.join(",")}
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={24} className="animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Processing file...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileText size={24} className="text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Click to upload</p>
                    <p className="text-xs text-muted-foreground">or drag and drop</p>
                  </div>
                  {fileName && <p className="text-xs text-primary mt-1">{fileName}</p>}
                </div>
              )}
            </button>
          </div>

          {/* Info note */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>✓ Text will be automatically extracted and searchable</p>
            <p>✓ Original file is stored for download</p>
            <p>✓ The extracted script opens in the reader after upload</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={14} className="mr-2" />
                Choose file
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
