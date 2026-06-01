// v5 Cmd+K search palette with quick actions
import { useState, useEffect } from "react";
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
  Keyboard, Briefcase, BarChart3, Image, Box, Calendar, Folder
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

  // Detect current project ID from the URL path (e.g. /projects/12/scripts)
  const projectMatch = window.location.pathname.match(/\/projects\/(\d+)/);
  const projectId = projectMatch ? parseInt(projectMatch[1], 10) : null;

  // Fetch current project details for navigation shortcuts
  const { data: currentProject } = useQuery<any>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId && open,
  });

  // Fetch all projects for global client-side project search
  const { data: allProjects } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    enabled: open,
  });

  // Server-side keyword search
  const { data: results, isLoading } = useQuery<SearchResults>({
    queryKey: ["/api/search", query],
    queryFn: async () => {
      if (!query.trim()) return { projects: [], scenes: [], scripts: [], assets: [], comments: [] };
      const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(query)}&limit=20`);
      return res.json();
    },
    enabled: query.trim().length > 0 && open,
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
    <CommandDialog
      open={open}
      onOpenChange={(v) => { onOpenChange(v); if (!v) setQuery(""); }}
      className="bg-[#111113] border border-white/10 text-white max-w-2xl shadow-2xl [&_[cmdk-input-wrapper]]:border-white/10 [&_[cmdk-input]]:text-white [&_[cmdk-item]]:text-white/80 [&_[cmdk-item][aria-selected=true]]:bg-white/10 [&_[cmdk-item][aria-selected=true]]:text-white [&_[cmdk-group-heading]]:text-white/40 border-l border-t border-r border-b [&_input]:placeholder:text-white/30 [&_input]:text-white"
    >
      <CommandInput
        placeholder="Type a command or search projects by name..."
        value={query}
        onValueChange={setQuery}
        data-testid="input-cmdk-search"
        className="text-white placeholder:text-white/30"
      />
      <CommandList className="max-h-[380px] overflow-y-auto p-2 bg-transparent text-white">
        
        {/* Quick navigation and active project context (always visible or prioritized when filtering) */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate("/dashboard")} data-testid="cmdk-go-dashboard" className="cursor-pointer">
            <LayoutDashboard size={14} className="mr-2 text-white/60" />
            <span>Dashboard</span>
          </CommandItem>
        </CommandGroup>

        {/* Current Project Sections */}
        {projectId && currentProject && (
          <CommandGroup heading={`Active Project: ${currentProject.project?.title || currentProject.title || "Context"}`}>
            <CommandItem onSelect={() => navigate(`/projects/${projectId}/script`)} className="cursor-pointer">
              <FileText size={14} className="mr-2 text-sky-400" />
              <span>Script</span>
            </CommandItem>
            <CommandItem onSelect={() => navigate(`/projects/${projectId}/storyboards`)} className="cursor-pointer">
              <Image size={14} className="mr-2 text-emerald-400" />
              <span>Storyboards</span>
            </CommandItem>
            <CommandItem onSelect={() => navigate(`/projects/${projectId}/assets`)} className="cursor-pointer">
              <Box size={14} className="mr-2 text-purple-400" />
              <span>Assets</span>
            </CommandItem>
            <CommandItem onSelect={() => navigate(`/projects/${projectId}/animatics`)} className="cursor-pointer">
              <Film size={14} className="mr-2 text-pink-400" />
              <span>Animatics</span>
            </CommandItem>
            <CommandItem onSelect={() => navigate(`/projects/${projectId}/scenes`)} className="cursor-pointer">
              <Calendar size={14} className="mr-2 text-amber-400" />
              <span>Scenes</span>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandSeparator className="bg-white/10" />

        {/* All Projects client-side filterable list */}
        {allProjects && allProjects.length > 0 && (
          <CommandGroup heading="Filter Projects">
            {allProjects.map((p) => (
              <CommandItem
                key={`all-proj-${p.id}`}
                value={`project ${p.title || p.name || ""}`}
                onSelect={() => navigate(`/projects/${p.id}`)}
                className="cursor-pointer"
              >
                <Folder size={14} className="mr-2 text-blue-400" />
                <span>{p.title || p.name}</span>
                {p.description && (
                  <span className="ml-2 text-xs text-white/40 truncate">— {p.description}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Server-side deep-search results */}
        {query.trim().length > 0 && (
          <>
            {isLoading && <CommandEmpty className="text-white/40">Searching deep database...</CommandEmpty>}
            {!isLoading && totalResults === 0 && (
              <CommandEmpty className="text-white/40">No deep matching database entries found.</CommandEmpty>
            )}

            {results && results.scenes.length > 0 && (
              <CommandGroup heading="Matching Scenes">
                {results.scenes.map((s: any) => (
                  <CommandItem
                    key={`scene-${s.id}`}
                    onSelect={() => navigate(`/projects/${s.project_id ?? s.projectId}`)}
                  >
                    <Film size={14} className="mr-2 text-white/60" />
                    <span>Scene <span className="font-mono">{s.number}</span> — {s.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results && results.scripts.length > 0 && (
              <CommandGroup heading="Matching Scripts">
                {results.scripts.map((s: any) => (
                  <CommandItem
                    key={`script-${s.id}`}
                    onSelect={() => navigate(`/projects/${s.project_id ?? s.projectId}`)}
                  >
                    <FileText size={14} className="mr-2 text-white/60" />
                    <span>{s.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results && results.assets.length > 0 && (
              <CommandGroup heading="Matching Assets">
                {results.assets.map((a: any) => (
                  <CommandItem
                    key={`asset-${a.id}`}
                    onSelect={() => navigate(`/projects/${a.project_id ?? a.projectId}`)}
                  >
                    <Package size={14} className="mr-2 text-white/60" />
                    <span>{a.filename}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        {/* Global actions when empty query */}
        {query.trim().length === 0 && (
          <>
            <CommandSeparator className="bg-white/10" />
            <CommandGroup heading="Quick Actions">
              <CommandItem
                onSelect={() => { close(); window.dispatchEvent(new CustomEvent("cel:new-project")); }}
                data-testid="cmdk-new-project"
                className="cursor-pointer"
              >
                <Plus size={14} className="mr-2 text-white/60" />
                <span>New project</span>
                <span className="ml-auto text-[11px] text-white/40 font-mono">⌘N</span>
              </CommandItem>
              <CommandItem onSelect={() => navigate("/inbox")} data-testid="cmdk-go-inbox" className="cursor-pointer">
                <Inbox size={14} className="mr-2 text-white/60" />
                <span>Inbox</span>
              </CommandItem>
              <CommandItem onSelect={() => navigate("/commissions")} data-testid="cmdk-go-commissions" className="cursor-pointer">
                <Briefcase size={14} className="mr-2 text-white/60" />
                <span>Commissions</span>
              </CommandItem>
              <CommandItem onSelect={() => navigate("/analytics")} data-testid="cmdk-go-analytics" className="cursor-pointer">
                <BarChart3 size={14} className="mr-2 text-white/60" />
                <span>Analytics</span>
              </CommandItem>
            </CommandGroup>
            
            <CommandGroup heading="Preferences">
              <CommandItem
                onSelect={() => { toggleTheme(); close(); }}
                data-testid="cmdk-toggle-theme"
                className="cursor-pointer"
              >
                {theme === "dark"
                  ? <Sun size={14} className="mr-2 text-white/60" />
                  : <Moon size={14} className="mr-2 text-white/60" />
                }
                <span>Switch to {theme === "dark" ? "light" : "dark"} mode</span>
              </CommandItem>
              <CommandItem onSelect={() => navigate("/settings")} data-testid="cmdk-go-settings" className="cursor-pointer">
                <Settings size={14} className="mr-2 text-white/60" />
                <span>Settings</span>
              </CommandItem>
              <CommandItem onSelect={() => navigate("/achievements")} data-testid="cmdk-go-achievements" className="cursor-pointer">
                <Trophy size={14} className="mr-2 text-white/60" />
                <span>Achievements</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
