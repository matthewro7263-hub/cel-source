// v5 Cmd+K search palette with quick actions
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/lib/theme";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import {
  FolderOpen, Film, FileText, Package, MessageSquare, Search,
  Plus, LayoutDashboard, Settings, Sun, Moon, Inbox, Trophy,
  Keyboard, Briefcase, BarChart3,
} from "lucide-react";

interface SearchResults {
  projects: any[];
  scenes: any[];
  scripts: any[];
  assets: any[];
  comments: any[];
}

interface CmdkPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CmdkPalette({ open, onOpenChange }: CmdkPaletteProps) {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();

  const { data: results, isLoading } = useQuery<SearchResults>({
    queryKey: ["/api/search", query],
    queryFn: async () => {
      if (!query.trim()) return { projects: [], scenes: [], scripts: [], assets: [], comments: [] };
      const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(query)}&limit=20`);
      return res.json();
    },
    enabled: query.trim().length > 0,
    staleTime: 10_000,
  });

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };

  const navigate = (path: string) => {
    setLocation(path);
    close();
  };

  const totalResults = results
    ? results.projects.length + results.scenes.length + results.scripts.length + results.assets.length + results.comments.length
    : 0;

  return (
    <CommandDialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setQuery(""); }}>
      <CommandInput
        placeholder="Search or jump to…"
        value={query}
        onValueChange={setQuery}
        data-testid="input-cmdk-search"
      />
      <CommandList>
        {/* Quick actions — always visible when no query typed */}
        {query.trim().length === 0 && (
          <>
            <CommandGroup heading="Quick Actions">
              <CommandItem
                onSelect={() => { close(); window.dispatchEvent(new CustomEvent("cel:new-project")); }}
                data-testid="cmdk-new-project"
              >
                <Plus size={14} className="mr-2 text-muted-foreground" />
                <span>New project</span>
                <span className="ml-auto text-[11px] text-muted-foreground/60 font-mono">⌘N</span>
              </CommandItem>
              <CommandItem onSelect={() => navigate("/dashboard")} data-testid="cmdk-go-dashboard">
                <LayoutDashboard size={14} className="mr-2 text-muted-foreground" />
                <span>Go to Dashboard</span>
              </CommandItem>
              <CommandItem onSelect={() => navigate("/inbox")} data-testid="cmdk-go-inbox">
                <Inbox size={14} className="mr-2 text-muted-foreground" />
                <span>Go to Inbox</span>
              </CommandItem>
              <CommandItem onSelect={() => navigate("/commissions")} data-testid="cmdk-go-commissions">
                <Briefcase size={14} className="mr-2 text-muted-foreground" />
                <span>Go to Commissions</span>
              </CommandItem>
              <CommandItem onSelect={() => navigate("/analytics")} data-testid="cmdk-go-analytics">
                <BarChart3 size={14} className="mr-2 text-muted-foreground" />
                <span>Go to Analytics</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Preferences">
              <CommandItem
                onSelect={() => { toggleTheme(); close(); }}
                data-testid="cmdk-toggle-theme"
              >
                {theme === "dark"
                  ? <Sun size={14} className="mr-2 text-muted-foreground" />
                  : <Moon size={14} className="mr-2 text-muted-foreground" />
                }
                <span>Switch to {theme === "dark" ? "light" : "dark"} mode</span>
              </CommandItem>
              <CommandItem onSelect={() => navigate("/settings")} data-testid="cmdk-go-settings">
                <Settings size={14} className="mr-2 text-muted-foreground" />
                <span>Open settings</span>
              </CommandItem>
              <CommandItem onSelect={() => navigate("/achievements")} data-testid="cmdk-go-achievements">
                <Trophy size={14} className="mr-2 text-muted-foreground" />
                <span>View achievements</span>
              </CommandItem>
              <CommandItem
                onSelect={() => { close(); window.dispatchEvent(new CustomEvent("cel:open-cheatsheet")); }}
                data-testid="cmdk-shortcuts"
              >
                <Keyboard size={14} className="mr-2 text-muted-foreground" />
                <span>Keyboard shortcuts</span>
                <span className="ml-auto text-[11px] text-muted-foreground/60 font-mono">?</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {/* Search results */}
        {query.trim().length > 0 && isLoading && (
          <CommandEmpty>Searching…</CommandEmpty>
        )}
        {query.trim().length > 0 && !isLoading && totalResults === 0 && (
          <CommandEmpty>No results for "{query}"</CommandEmpty>
        )}

        {results && results.projects.length > 0 && (
          <CommandGroup heading="Projects">
            {results.projects.map((p: any) => (
              <CommandItem
                key={`project-${p.id}`}
                onSelect={() => navigate(`/projects/${p.id}`)}
                data-testid={`cmdk-project-${p.id}`}
              >
                <FolderOpen size={14} className="mr-2 text-muted-foreground" />
                <span className="font-medium">{p.title}</span>
                {p.description && (
                  <span className="ml-2 text-xs text-muted-foreground truncate">{p.description}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results && results.scenes.length > 0 && (
          <CommandGroup heading="Scenes">
            {results.scenes.map((s: any) => (
              <CommandItem
                key={`scene-${s.id}`}
                onSelect={() => navigate(`/projects/${s.project_id ?? s.projectId}`)}
                data-testid={`cmdk-scene-${s.id}`}
              >
                <Film size={14} className="mr-2 text-muted-foreground" />
                <span className="font-medium">{s.number} — {s.title}</span>
                {s.description && (
                  <span className="ml-2 text-xs text-muted-foreground truncate">{s.description}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results && results.scripts.length > 0 && (
          <CommandGroup heading="Scripts">
            {results.scripts.map((s: any) => (
              <CommandItem
                key={`script-${s.id}`}
                onSelect={() => navigate(`/projects/${s.project_id ?? s.projectId}`)}
                data-testid={`cmdk-script-${s.id}`}
              >
                <FileText size={14} className="mr-2 text-muted-foreground" />
                <span className="font-medium">{s.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results && results.assets.length > 0 && (
          <CommandGroup heading="Assets">
            {results.assets.map((a: any) => (
              <CommandItem
                key={`asset-${a.id}`}
                onSelect={() => navigate(`/projects/${a.project_id ?? a.projectId}`)}
                data-testid={`cmdk-asset-${a.id}`}
              >
                <Package size={14} className="mr-2 text-muted-foreground" />
                <span className="font-medium">{a.filename}</span>
                {a.notes && (
                  <span className="ml-2 text-xs text-muted-foreground truncate">{a.notes}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results && results.comments.length > 0 && (
          <CommandGroup heading="Comments">
            {results.comments.map((c: any) => (
              <CommandItem
                key={`comment-${c.id}`}
                onSelect={() => navigate(`/projects/${c.project_id ?? c.projectId}`)}
                data-testid={`cmdk-comment-${c.id}`}
              >
                <MessageSquare size={14} className="mr-2 text-muted-foreground" />
                <span className="truncate text-sm">{c.body}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
