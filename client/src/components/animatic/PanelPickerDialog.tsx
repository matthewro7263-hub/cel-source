/**
 * Panel Picker Dialog — shown when clicking empty area on Panels track.
 * Lists all storyboard panels in the project for selection.
 */
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Storyboard, Panel } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface StoryboardWithPanels extends Storyboard {
  panels: Panel[];
}

interface PanelPickerDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  onSelectPanel: (panel: Panel) => void;
}

export function PanelPickerDialog({ open, onClose, projectId, onSelectPanel }: PanelPickerDialogProps) {
  const { data: storyboards, isLoading } = useQuery<StoryboardWithPanels[]>({
    queryKey: ["/api/projects", projectId, "storyboards"],
    queryFn: async () =>
      (await apiRequest("GET", `/api/projects/${projectId}/storyboards`)).json(),
    enabled: open,
  });

  const allPanels = storyboards?.flatMap((sb) =>
    sb.panels.map((p) => ({ ...p, storyboardTitle: sb.title })),
  ) ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Pick a Storyboard Panel</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            Loading panels…
          </div>
        )}

        {!isLoading && allPanels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <p className="text-muted-foreground text-sm">No storyboard panels yet.</p>
            <p className="text-xs text-muted-foreground">
              Create panels in the Storyboards tab first.
            </p>
          </div>
        )}

        {allPanels.length > 0 && (
          <div className="overflow-y-auto flex-1 mt-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
              {allPanels.map((panel) => (
                <button
                  key={panel.id}
                  className="rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-primary/50 hover:bg-white/10 transition-all group text-left"
                  onClick={() => {
                    onSelectPanel(panel);
                    onClose();
                  }}
                >
                  <div className="aspect-video bg-black/50 overflow-hidden">
                    <img
                      src={panel.imageData || undefined}
                      alt={panel.caption || "Panel"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{panel.caption || "Untitled Panel"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{panel.storyboardTitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
