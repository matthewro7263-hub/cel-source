// v4 Keyboard shortcuts cheatsheet modal
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SHORTCUT_DEFS } from "@/hooks/use-global-shortcuts";

interface ShortcutsCheatsheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function KbdBadge({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((k, i) => (
        <span key={i}>
          <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted text-[11px] font-mono font-medium">{k}</kbd>
          {i < keys.length - 1 && <span className="text-muted-foreground text-xs mx-0.5">then</span>}
        </span>
      ))}
    </span>
  );
}

export function ShortcutsCheatsheet({ open, onOpenChange }: ShortcutsCheatsheetProps) {
  const categories = Array.from(new Set(SHORTCUT_DEFS.map((s) => s.category)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
          {categories.map((cat) => (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</h3>
              <div className="space-y-2">
                {SHORTCUT_DEFS.filter((s) => s.category === cat).map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{s.description}</span>
                    <KbdBadge keys={s.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
