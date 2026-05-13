import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getAuthToken } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, FileText, Image as ImageIcon, Database, Loader2, History, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Link } from "wouter";

export function BakSettingsExports({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [exportingKind, setExportingKind] = useState<string | null>(null);

  const { data: snapshots } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/studio/snapshots`],
  });

  const snapshotMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/${projectId}/studio/snapshots`, { label: snapshotLabel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/studio/snapshots`] });
      setSnapshotLabel("");
      toast({ title: "Snapshot created" });
    },
    onError: () => {
      toast({ title: "Failed to create snapshot", variant: "destructive" });
    }
  });

  const restoreSnapMut = useMutation({
    mutationFn: async (snapId: number) => {
      await apiRequest("POST", `/api/projects/${projectId}/studio/snapshots/${snapId}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      toast({ title: "Snapshot restored", description: "Project state has been reloaded." });
      window.location.reload();
    },
    onError: () => {
      toast({ title: "Failed to restore snapshot", variant: "destructive" });
    }
  });

  const fetchExport = async (url: string, defaultFilename: string, kindKey: string) => {
    setExportingKind(kindKey);
    try {
      const token = getAuthToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;

      // Try to get filename from content-disposition
      const disp = res.headers.get('content-disposition');
      if (disp && disp.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]+)"/.exec(disp);
        if (matches != null && matches[1]) defaultFilename = matches[1];
      }

      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objUrl);
      document.body.removeChild(a);
      toast({ title: "Export downloaded" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExportingKind(null);
    }
  };

  const handleExportTimeCapsule = () => {
    fetchExport(`/api/projects/${projectId}/archive`, "project.cel-archive", "archive");
  };

  const handleFormatExport = (kind: string, filename: string) => {
    fetchExport(`/api/projects/${projectId}/export/${kind}`, filename, kind);
  };

  const isExporting = (kind: string) => exportingKind === kind;

  return (
    <>
      <div className="rounded-xl border border-card-border bg-card p-5 mt-6">
        <h3 className="text-lg font-semibold mb-4">Export & Backup</h3>

        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium mb-2">Portable Export</div>
            <Button onClick={handleExportTimeCapsule} disabled={isExporting("archive")} className="bg-[#9DD0FF] hover:bg-[#AED9FF] text-black w-full justify-start">
              {isExporting("archive") ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}
              {isExporting("archive") ? "Exporting…" : "Export .cel-archive Time Capsule"}
            </Button>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Format-Specific Exports</div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => handleFormatExport('scripts-pdf', 'scripts.md')} disabled={isExporting("scripts-pdf")} className="bg-[#e2e8f0] hover:bg-[#cbd5e1] text-black justify-start">
                {isExporting("scripts-pdf") ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Scripts (Markdown)
              </Button>
              <Button onClick={() => handleFormatExport('storyboards-zip-png', 'storyboards.zip')} disabled={isExporting("storyboards-zip-png")} className="bg-[#e2e8f0] hover:bg-[#cbd5e1] text-black justify-start">
                {isExporting("storyboards-zip-png") ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                Storyboards (ZIP/PNG)
              </Button>
              <Button onClick={() => handleFormatExport('scenes-csv', 'scenes.csv')} disabled={isExporting("scenes-csv")} className="bg-[#e2e8f0] hover:bg-[#cbd5e1] text-black justify-start">
                {isExporting("scenes-csv") ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                Scenes (CSV)
              </Button>
              <Button onClick={() => handleFormatExport('comments-csv', 'comments.csv')} disabled={isExporting("comments-csv")} className="bg-[#e2e8f0] hover:bg-[#cbd5e1] text-black justify-start">
                {isExporting("comments-csv") ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                Comments (CSV)
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <History size={14} />
              Branching Snapshots
            </div>
            <div className="flex gap-2 mb-4">
              <Input
                value={snapshotLabel}
                onChange={e => setSnapshotLabel(e.target.value)}
                placeholder="e.g. before color redesign"
                onKeyDown={e => { if (e.key === "Enter" && snapshotLabel.trim()) snapshotMut.mutate(); }}
              />
              <Button onClick={() => snapshotMut.mutate()} disabled={!snapshotLabel.trim() || snapshotMut.isPending}>
                {snapshotMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </Button>
            </div>

            {snapshots && snapshots.length > 0 && (
              <div className="space-y-2">
                {snapshots.map((snap: any) => (
                  <div key={snap.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                    <span>{snap.label} <span className="text-xs text-muted-foreground ml-2">{new Date(snap.createdAt).toLocaleString()}</span></span>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="gap-1">
                          <RotateCcw size={12} /> Restore
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restore Snapshot?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will overwrite your current project state with "{snap.label}". Any changes made since this snapshot will be lost.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => restoreSnapMut.mutate(snap.id)} className="bg-destructive text-destructive-foreground">
                            Nuke & Restore
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border">
            <div className="text-sm font-medium mb-2">Trash Recovery & Game Dev Utilities</div>
            <div className="flex gap-2">
              <Link href={`/projects/${projectId}/trash`}>
                <Button variant="outline" className="justify-start">
                  Trash Recovery
                </Button>
              </Link>
              <Link href={`/projects/${projectId}/spritesheet`}>
                <Button variant="outline" className="justify-start">
                  Sprite-Sheet Auto-Packer
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
