import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Clapperboard, Calendar, ArrowRight, Activity, MessageSquare, Upload } from "lucide-react";
import { chipClass, deadlineToneClass, formatAbsolute, formatDeadline, formatRelative, initials, STATUS_LABELS } from "@/lib/utils-cel";
import { useToast } from "@/hooks/use-toast";
import { PanelImage } from "@/components/PanelImage";

const COLORS = ["#6E4FE8", "#E8744F", "#4FBFE8", "#E84F9F", "#4FE89A", "#E8C44F", "#E84F4F"];

interface QueueItem {
  project: {
    id: number;
    title: string;
    status: string;
    coverColor: string;
    deadline: string | null;
  };
  currentScene: {
    id: number;
    number: string;
    title: string;
    status: string;
    deadline: string | null;
  } | null;
  lastPanel: {
    id: number;
    storyboardId: number;
    orderIdx: number;
    imageData: string | null;
    r2Key: string | null;
    caption: string;
    dialogue: string;
  } | null;
  pendingItemsCount: number;
}

interface ActivityItem {
  id: string;
  projectId: number;
  projectTitle: string;
  type: "comment" | "asset";
  user: {
    name: string;
    avatarColor: string;
  };
  content: string;
  timestamp: string;
}

export default function Dashboard() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [useBibleTemplate, setUseBibleTemplate] = useState(false);

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Query our new aggregated endpoint
  const { data: queueData, isLoading, isError, refetch, isFetching } = useQuery<{
    queueItems: QueueItem[];
    recentActivity: ActivityItem[];
  }>({
    queryKey: ["/api/production/queue"],
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/projects", {
        title, description, deadline: deadline || null, coverColor: color,
      });
      const newProj = await r.json();
      if (useBibleTemplate) {
        await apiRequest("POST", `/api/projects/${newProj.id}/lor_seed_bible`);
      }
      return newProj;
    },
    onSuccess: (newProj) => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setOpen(false);
      setTitle(""); setDescription(""); setDeadline(""); setUseBibleTemplate(false);
      toast({ title: "Project created" });
      setLocation(`/projects/${newProj.id}`);
    },
    onError: (err: any) => toast({ title: "Couldn't create", description: String(err.message || err), variant: "destructive" }),
  });

  const createSandbox = useMutation({
    mutationFn: async () => {
      const projectRes = await apiRequest("POST", "/api/projects", {
        title: "Cel Sandbox",
        description: "A safe sample project for trying storyboards, video edits, review rituals, palettes, and exports.",
        deadline: null,
        coverColor: "#9DD0FF",
      });
      const project = await projectRes.json();
      await apiRequest("POST", `/api/projects/${project.id}/scripts`, {
        title: "Sandbox Script",
        content: "INT. STUDIO - DAY\n\nA tiny character discovers a glowing storyboard panel and tests every Cel workflow without risking a real project.",
      });
      await apiRequest("POST", `/api/projects/${project.id}/scenes`, {
        number: "001",
        title: "Sandbox kickoff",
        description: "Try timers, status changes, render budget, and credit export here.",
        status: "storyboard",
        deadline: null,
      });
      const storyboardRes = await apiRequest("POST", `/api/projects/${project.id}/storyboards`, {
        title: "Sandbox Boards",
      });
      const storyboard = await storyboardRes.json();
      for (let i = 0; i < 3; i += 1) {
        await apiRequest("POST", `/api/storyboards/${storyboard.id}/panels`, {
          imageData: sandboxPanelDataUrl(i),
          caption: ["Opening pose", "Gesture test", "Final beat"][i],
          dialogue: ["Ready?", "Try the tools.", "Ship it."][i],
        });
      }
      await apiRequest("POST", `/api/projects/${project.id}/lor_seed_bible`, {});
      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Sandbox project created" });
      setLocation(`/projects/${project.id}`);
    },
    onError: (err: any) => toast({ title: "Couldn't create sandbox", description: String(err.message || err), variant: "destructive" }),
  });

  return (
    <div className="relative z-10 min-h-screen px-6 lg:px-10 py-8 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-border">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Active production queue
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => createSandbox.mutate()} 
            disabled={createSandbox.isPending}
            className="rounded-[4px] font-mono text-xs h-9 px-4"
          >
            {createSandbox.isPending ? "Creating Sandbox…" : "Sandbox Project"}
          </Button>

          <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setUseBibleTemplate(false); }}>
            <DialogTrigger asChild>
              <Button 
                variant="default"
                size="sm"
                data-testid="button-new-project"
                className="rounded-[4px] bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-xs h-9 px-4"
              >
                <Plus size={14} className="mr-1" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-mono text-sm uppercase tracking-wider">Create new project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground">Title</Label>
                  <Input 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="Project title" 
                    data-testid="input-project-title" 
                    className="rounded-lg border-border bg-card/50 text-foreground" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground">Description</Label>
                  <Textarea 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Brief description (optional)" 
                    rows={3} 
                    data-testid="input-project-description" 
                    className="rounded-lg border-border bg-card/50 text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground">Deadline</Label>
                  <Input 
                    type="date" 
                    value={deadline} 
                    onChange={(e) => setDeadline(e.target.value)} 
                    data-testid="input-project-deadline" 
                    className="rounded-lg border-border bg-card/50 text-foreground" 
                  />
                </div>
                <div className="flex items-center space-x-2 rounded-lg border border-border px-3 py-2.5 glass">
                  <Checkbox
                    id="use-bible-template"
                    checked={useBibleTemplate}
                    onCheckedChange={(checked) => setUseBibleTemplate(checked === true)}
                    className="rounded-sm border-border"
                  />
                  <Label htmlFor="use-bible-template" className="text-xs font-mono text-muted-foreground cursor-pointer">
                    Seed with Bible template
                  </Label>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground">Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          color === c ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                        data-testid={`button-color-${c}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-6 flex gap-2">
                <Button variant="ghost" className="rounded-lg text-xs font-mono" onClick={() => { setOpen(false); setUseBibleTemplate(false); }}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={() => create.mutate()}
                  disabled={!title || create.isPending}
                  data-testid="button-create-project"
                  className="rounded-lg text-xs font-mono"
                >
                  {create.isPending ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 glass rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-96 glass rounded-2xl animate-pulse" />
        </div>
      ) : isError ? (
        <div className="glass py-16 px-6 flex flex-col items-center text-center">
          <p className="text-sm text-muted-foreground mb-4 font-mono">Couldn't load the production queue.</p>
          <Button
            variant="default"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-retry-queue"
            className="rounded-[4px] bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-mono h-9 px-4"
          >
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : !queueData || queueData.queueItems.length === 0 ? (
        <EmptyState onNew={() => setOpen(true)} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          {/* LEFT: Active Production Queue */}
          <div className="space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <Activity size={12} className="text-primary" />
              Queue ({queueData.queueItems.length} active projects)
            </h2>

            <div className="space-y-3">
              {queueData.queueItems.map((item) => {
                const deadlineInfo = formatDeadline(item.project.deadline);
                const deadlineClass = deadlineToneClass(deadlineInfo.tone);

                const statusLabel = STATUS_LABELS[item.currentScene?.status ?? ""] ?? item.currentScene?.status;

                return (
                  <div
                    key={item.project.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setLocation(`/projects/${item.project.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setLocation(`/projects/${item.project.id}`);
                      }
                    }}
                    className="glass p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all hover:shadow-[var(--neu-shadow-raised-hover)] cursor-pointer"
                    data-testid={`queue-item-${item.project.id}`}
                  >
                    {/* Project & Scene details */}
                    <div className="flex-1 min-w-0 flex items-start gap-3">
                      <div 
                        className="w-1.5 h-12 shrink-0 rounded-[2px]" 
                        style={{ backgroundColor: item.project.coverColor }}
                      />
                      <div className="space-y-1">
                        <span
                          className="font-mono font-bold text-sm tracking-tight text-foreground hover:text-primary transition-colors block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.project.title}
                        </span>
                        
                        {/* Current Shot / Scene */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {item.currentScene ? (
                            <>
                              <span className="text-muted-foreground">Current:</span>
                               <span className="text-foreground font-semibold">
                                 Scene <span className="font-mono">{item.currentScene.number}</span> - {item.currentScene.title}
                               </span>
                              <span className={`${chipClass(item.currentScene.status)} font-mono text-[10px] uppercase tracking-wider`}>
                                {statusLabel}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">No active scene in work</span>
                          )}

                          {item.project.deadline && (
                            <span className={`font-mono text-[11px] flex items-center gap-1 ml-1 ${deadlineClass}`}>
                              <Calendar size={11} /> {deadlineInfo.text}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Last edited panel thumbnail */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">Last edit</span>
                        {item.lastPanel ? (
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/projects/${item.project.id}/storyboards?panel=${item.lastPanel.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <PanelImage
                                panel={item.lastPanel}
                                projectId={item.project.id}
                                className="w-16 h-10 object-cover rounded-[4px] border border-border bg-black hover:ring-1 hover:ring-primary cursor-pointer transition-all"
                                alt="Last edit thumbnail"
                                loading="lazy"
                                decoding="async"
                                fallback={
                                  <div className="w-16 h-10 bg-muted border border-border flex items-center justify-center text-[8px] text-muted-foreground rounded-[4px] font-mono">
                                    NO IMAGE
                                  </div>
                                }
                              />
                            </Link>
                            <div className="max-w-[120px] text-left">
                              <div className="text-[10px] font-mono text-foreground truncate">
                                Panel #{item.lastPanel.orderIdx + 1}
                              </div>
                              {item.lastPanel.caption && (
                                <div className="text-[9px] text-muted-foreground truncate italic">
                                  "{item.lastPanel.caption}"
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="w-32 h-10 border border-dashed border-border flex items-center justify-center rounded-[4px] text-[10px] font-mono text-muted-foreground">
                            No panels created
                          </div>
                        )}
                      </div>

                      {/* Pending count badge */}
                      <div className="text-right flex items-center gap-3">
                        <div className="space-y-0.5 min-w-[64px]">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">Pending</span>
                          <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-300">
                            {item.pendingItemsCount} items
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/projects/${item.project.id}`);
                          }}
                          className="w-7 h-7 rounded-[4px] bg-muted hover:bg-accent border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={`Open ${item.project.title}`}
                        >
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Recent Activity Feed */}
          <div className="space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <Activity size={12} className="text-primary" />
              Recent Activity
            </h2>

            <div className="glass p-4 space-y-4 min-h-[300px]">
              {queueData.recentActivity.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground italic font-mono">
                  No recent activity logged
                </div>
              ) : (
                <div className="space-y-4 divide-y divide-border/60">
                  {queueData.recentActivity.map((activity, idx) => {
                    const isComment = activity.type === "comment";
                    return (
                      <div key={activity.id} className={`pt-3 first:pt-0 flex gap-2.5 text-xs`}>
                        {/* Compact rounded 4px avatar */}
                        <div 
                          className="w-5 h-5 rounded-[4px] shrink-0 flex items-center justify-center font-mono font-bold text-[10px] text-white uppercase"
                          style={{ backgroundColor: activity.user.avatarColor }}
                        >
                          {initials(activity.user.name) || "?"}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold text-foreground font-mono">{activity.user.name}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                              <span title={formatAbsolute(activity.timestamp)}>{formatRelative(activity.timestamp)}</span>
                            </span>
                          </div>

                          <div className="text-xs text-muted-foreground leading-relaxed break-words">
                            <span className="flex items-center gap-1 text-[10px] font-mono text-primary uppercase mb-0.5">
                              {isComment ? (
                                <MessageSquare size={10} />
                              ) : (
                                <Upload size={10} />
                              )}
                              {activity.projectTitle}
                            </span>
                            {activity.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function sandboxPanelDataUrl(index: number): string {
  const colors = ["#9DD0FF", "#E8C44F", "#4FE89A"];
  const title = ["OPEN", "TRY", "DONE"][index] || "CEL";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#10131a"/><rect x="140" y="110" width="1000" height="500" rx="4" fill="${colors[index % colors.length]}" opacity="0.18" stroke="${colors[index % colors.length]}" stroke-width="8"/><circle cx="${360 + index * 170}" cy="350" r="92" fill="${colors[index % colors.length]}"/><rect x="560" y="292" width="360" height="116" rx="4" fill="#ffffff" opacity="0.9"/><text x="740" y="365" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#10131a">${title}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="glass py-20 px-6 flex flex-col items-center text-center">
      <div className="mb-6">
        <svg width="120" height="120" viewBox="0 0 160 160" className="opacity-70 text-primary">
          <rect x="20" y="30" width="120" height="100" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
          <rect x="28" y="42" width="8" height="8" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="124" y="42" width="8" height="8" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="28" y="76" width="8" height="8" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="124" y="76" width="8" height="8" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="28" y="110" width="8" height="8" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="124" y="110" width="8" height="8" rx="1" fill="currentColor" opacity="0.6" />
          <line x1="80" y1="60" x2="80" y2="100" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
          <line x1="60" y1="80" x2="100" y2="80" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
        </svg>
      </div>
      <h3 className="font-mono text-sm uppercase tracking-wider text-foreground mb-2">No projects in production</h3>
      <p className="text-xs text-muted-foreground mb-6 max-w-sm font-mono leading-relaxed">
        Start by creating your first animation project. You will get scenes, scripts, storyboards, and activity feeds.
      </p>
      <Button 
        variant="default" 
        onClick={onNew} 
        data-testid="button-empty-new-project"
        className="rounded-[4px] bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-mono h-9 px-4"
      >
        <Plus size={14} className="mr-1" /> Create first project
      </Button>
    </div>
  );
}
