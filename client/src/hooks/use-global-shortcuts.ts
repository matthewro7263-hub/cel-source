// v4 Global keyboard shortcuts hook
import { useEffect, useCallback, useRef } from "react";

interface ShortcutHandlers {
  onOpenSearch: () => void;
  onOpenNewProject: () => void;
  onNavigate: (path: string) => void;
  onOpenCheatsheet: () => void;
}

const SHORTCUTS = [
  { keys: ["?"], description: "Open keyboard shortcuts", category: "General" },
  { keys: ["Cmd/Ctrl", "K"], description: "Open search", category: "General" },
  { keys: ["g", "d"], description: "Go to dashboard", category: "Navigation" },
  { keys: ["g", "c"], description: "Go to commissions", category: "Navigation" },
  { keys: ["g", "a"], description: "Go to achievements", category: "Navigation" },
  { keys: ["g", "i"], description: "Go to inbox", category: "Navigation" },
  { keys: ["n", "p"], description: "New project", category: "Actions" },
  { keys: ["j"], description: "Next scene (in Scenes tab)", category: "Scenes" },
  { keys: ["k"], description: "Previous scene (in Scenes tab)", category: "Scenes" },
];

export const SHORTCUT_DEFS = SHORTCUTS;

export function useGlobalShortcuts(handlers: ShortcutHandlers) {
  const sequenceRef = useRef<string[]>([]);
  const seqTimeoutRef = useRef<number | null>(null);

  const clearSequence = useCallback(() => {
    sequenceRef.current = [];
  }, []);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true") {
        // Allow Cmd+K even in inputs
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          handlers.onOpenSearch();
        }
        return;
      }

      // Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handlers.onOpenSearch();
        clearSequence();
        return;
      }

      // Single key shortcuts
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === "?") {
          e.preventDefault();
          handlers.onOpenCheatsheet();
          clearSequence();
          return;
        }

        // Sequence shortcuts (g d, g c, g a, g i, n p)
        const key = e.key.toLowerCase();
        sequenceRef.current.push(key);

        // Clear sequence after 1.5s
        if (seqTimeoutRef.current) window.clearTimeout(seqTimeoutRef.current);
        seqTimeoutRef.current = window.setTimeout(clearSequence, 1500);

        const seq = sequenceRef.current.join("");

        if (seq === "gd") {
          e.preventDefault();
          handlers.onNavigate("/dashboard");
          clearSequence();
        } else if (seq === "gc") {
          e.preventDefault();
          handlers.onNavigate("/commissions");
          clearSequence();
        } else if (seq === "ga") {
          e.preventDefault();
          handlers.onNavigate("/achievements");
          clearSequence();
        } else if (seq === "gi") {
          e.preventDefault();
          handlers.onNavigate("/inbox");
          clearSequence();
        } else if (seq === "np") {
          e.preventDefault();
          handlers.onOpenNewProject();
          clearSequence();
        }
      }
    };

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [handlers, clearSequence]);
}
