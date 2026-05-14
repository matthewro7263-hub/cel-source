import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  FileText, Image as ImageIcon, Film, ListChecks, Users, Settings as SettingsIcon,
  Plus, Trash2, Upload, Calendar, Share2, Copy, MessageSquare, Eye, X,
  Package, ChevronDown, ChevronRight as ChevronRightIcon, ExternalLink, Presentation,
  Monitor, Loader2, Mic, Box, GitBranch, Scroll, Columns2, Radio, Wand2,
Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DOMPurify from "dompurify";
import { Document, Page, pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
import ReactMarkdown from "react-markdown";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDeadline, STATUS_LABELS, STATUS_ORDER, statusClass, initials, youTubeId, vimeoId } from "@/lib/utils-cel";
import type { Project, Script, Storyboard, Panel, Animatic, Scene, Render } from "@shared/schema";
import { GlassButton } from "@/components/ui/glass-button";
import { StoryboardReviewer } from "@/components/storyboard-reviewer";
import { AssetsTab } from "@/pages/AssetsTab";
import { BakSettingsExports } from "@/components/bak-settings-panel";

// === AGENT_1 ADDITIONS START ===
import { CliBrandSettings } from "@/components/cli-brand-settings";
// === AGENT_1 ADDITIONS END ===
// === AGENT_3 ADDITIONS START ===
import ContinuityTab from "./lor/ContinuityTab";
import CastingTab from "./lor/CastingTab";
import LoreSafeChecklist from "./lor/LoreSafeChecklist";
// === AGENT_3 ADDITIONS END ===
// === APPROVAL ADDITIONS START ===
import SignOffPanel from "./approval/SignOffPanel";
// === APPROVAL ADDITIONS END ===

// v4 feature imports
import { SketchModal } from "@/components/storyboard-sketch";
import { PanelPinsOverlay, PinModeToggle } from "@/components/panel-pins";
import { TagsSettingsPanel, InlineTagSelector } from "@/components/tags-manager";
import { SceneTimerButton, SceneTimeBreakdown } from "@/components/scene-timer";
import { Pencil, MapPin, Sparkles, Tag, KeyRound, BookOpen, ClipboardCheck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface ProjectDetail {
  project: Project;
  members: { id: number; userId: number; role: string; user: { id: number; name: string; email: string; avatarColor: string } | null }[];
}


function getAuthToken() {
    try {
      const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
      if (match) return decodeURIComponent(match[1]);
      return localStorage.getItem("cel_token") || "";
    } catch (e) {}
    return "";
  }
export default function ProjectWorkspace() {
  const params = useParams() as { id: string };
  const projectId = parseInt(params.id, 10);
  const [tab, setTab] = useState("overview");
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<ProjectDetail>({
    queryKey: ["/api/projects", projectId],
  });

  if (isLoading) {
    return (
      <div className="px-6 lg:px-10 py-8 lg:py-12 max-w-6xl mx-auto">
        <div className="h-7 w-72 bg-muted rounded animate-pulse mb-3" />
        <div className="h-4 w-96 bg-muted rounded animate-pulse mb-8" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }
  if (!data) return <div className="p-10 text-muted-foreground">Project not found.</div>;

  const { project, members } = data;
  const d = formatDeadline(project.deadline);

  return (
    <div className="px-5 sm:px-6 lg:px-10 py-7 lg:py-10 max-w-6xl mx-auto">
      <div className="mb-7 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project.coverColor }} />
            <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Project</span>
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight mb-2" data-testid={`text-project-title`}>{project.title}</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">{project.description || "No description yet."}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs flex items-center gap-1.5 text-muted-foreground">
            <Calendar size={12} />{d.text}
          </span>
          <Button variant="outline" size="sm" onClick={() => { window.location.hash = `/projects/${projectId}/video-editor`; }} className="text-xs" data-testid="link-video-editor">
            <Film size={14} className="mr-1.5" /> Video Editor
          </Button>
          <Button variant="outline" size="sm" onClick={() => { window.location.hash = `/projects/${projectId}/compare`; }} className="text-xs" data-testid="link-compare">
            <Columns2 size={14} className="mr-1.5" /> Compare
          </Button>
          <Button variant="outline" size="sm" onClick={() => { window.location.hash = `/projects/${projectId}/review-room`; }} className="text-xs" data-testid="link-review-room">
            <Radio size={14} className="mr-1.5" /> Review Room
          </Button>
          <Button variant="outline" size="sm" onClick={() => { window.location.hash = `/projects/${projectId}/palette`; }} className="text-xs">
            <ImageIcon size={14} className="mr-1.5" /> Palette Matcher
          </Button>
          <Button variant="outline" size="sm" onClick={() => { window.location.hash = `/projects/${projectId}/inbetween`; }} className="text-xs" data-testid="link-inbetween">
            <Wand2 size={14} className="mr-1.5" /> Inbetween Lab
          </Button>
          <Button variant="outline" size="sm" onClick={() => { window.location.hash = `/projects/${projectId}/bible`; }} className="text-xs" data-testid="link-episode-bible">
            <BookOpen size={14} className="mr-1.5" /> Episode Bible
          </Button>
          {/* === AGENT_STUDIO ADDITIONS START === */}
          <Button variant="outline" size="sm" onClick={() => { window.location.hash = `/projects/${projectId}/render-budget`; }} className="text-xs" data-testid="link-render-budget">
            <Film size={14} className="mr-1.5" /> Render Budget
          </Button>
          <Button variant="outline" size="sm" onClick={() => { window.location.hash = `/projects/${projectId}/snapshots`; }} className="text-xs" data-testid="link-snapshots">
            <GitBranch size={14} className="mr-1.5" /> Snapshots
          </Button>
          <Button variant="outline" size="sm" onClick={() => { window.location.hash = `/projects/${projectId}/credits`; }} className="text-xs" data-testid="link-credits">
            <Scroll size={14} className="mr-1.5" /> Credits
          </Button>
          {/* === AGENT_STUDIO ADDITIONS END === */}
          <div className="flex -space-x-1.5">
            {members.slice(0, 4).map((m) => m.user && (
              <Avatar key={m.id} className="h-7 w-7 ring-2 ring-background">
                <AvatarFallback style={{ backgroundColor: m.user.avatarColor, color: "white" }} className="text-[10px] font-semibold">
                  {initials(m.user.name)}
                </AvatarFallback>
              </Avatar>

            ))}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 flex flex-wrap h-auto">
          <TabsTrigger value="overview" data-testid="tab-overview"><FileText size={14} className="mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="script" data-testid="tab-script"><FileText size={14} className="mr-1.5" />Script</TabsTrigger>
          <TabsTrigger value="storyboards" data-testid="tab-storyboards"><ImageIcon size={14} className="mr-1.5" />Storyboards</TabsTrigger>
          <TabsTrigger value="assets" data-testid="tab-assets"><Package size={14} className="mr-1.5" />Assets</TabsTrigger>
          <TabsTrigger value="animatics" data-testid="tab-animatics"><Film size={14} className="mr-1.5" />Animatics</TabsTrigger>
          <TabsTrigger value="scenes" data-testid="tab-scenes"><ListChecks size={14} className="mr-1.5" />Scenes</TabsTrigger>
          <TabsTrigger value="comments" data-testid="tab-comments"><MessageSquare size={14} className="mr-1.5" />Comments</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings"><SettingsIcon size={14} className="mr-1.5" />Settings</TabsTrigger>
          {/* === AGENT_3 ADDITIONS START === */}
          <TabsTrigger value="continuity" data-testid="tab-continuity"><BookOpen size={14} className="mr-1.5" />Continuity</TabsTrigger>
          <TabsTrigger value="casting" data-testid="tab-casting"><Users size={14} className="mr-1.5" />Casting</TabsTrigger>
          {/* === AGENT_3 ADDITIONS END === */}
          {/* === APPROVAL ADDITIONS START === */}
          <TabsTrigger value="signoff" data-testid="tab-signoff"><ClipboardCheck size={14} className="mr-1.5" />Sign-off</TabsTrigger>
          {/* === APPROVAL ADDITIONS END === */}
        </TabsList>

        <TabsContent value="overview"><OverviewTab project={project} members={members} setTab={setTab} /></TabsContent>
        <TabsContent value="script"><ScriptTab projectId={projectId} /></TabsContent>
        <TabsContent value="storyboards"><StoryboardsTab projectId={projectId} /></TabsContent>
        <TabsContent value="assets"><AssetsTab projectId={projectId} /></TabsContent>
        <TabsContent value="animatics"><AnimaticsTab projectId={projectId} /></TabsContent>
        <TabsContent value="scenes"><ScenesTab projectId={projectId} /></TabsContent>
        <TabsContent value="comments"><CommentsTab projectId={projectId} /></TabsContent>
        <TabsContent value="settings"><SettingsTab project={project} members={members} /></TabsContent>
        {/* === AGENT_3 ADDITIONS (relocated inside Tabs root) === */}
        <TabsContent value="continuity"><ContinuityTab projectId={projectId} /></TabsContent>
        <TabsContent value="casting"><CastingTab projectId={projectId} /></TabsContent>
        {/* === APPROVAL ADDITIONS START === */}
        <TabsContent value="signoff"><SignOffPanel projectId={projectId} /></TabsContent>
        {/* === APPROVAL ADDITIONS END === */}
      </Tabs>

      {/* v5 quick-action toolbar — relocated from inside TabsList where they crashed layout */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => { window.location.hash = `/projects/${projectId}/audio2`; }}
          data-testid="button-audio-tools"
        >
          <Mic size={14} className="mr-1.5" /> Audio Tools
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="glass h-8 border border-white/20"
          onClick={() => setLocation(`/projects/${projectId}/couch`)}
        >
          <Presentation size={14} className="mr-1.5" /> Couch Mode
        </Button>
        <GlassButton
          className="bg-[#9DD0FF] text-black hover:bg-[#AED9FF] text-sm h-8"
          onClick={() => setLocation(`/projects/${projectId}/voicebooth`)}
        >
          <Mic size={14} className="mr-1.5" /> Voice Booth
        </GlassButton>
      </div>
    </div>
  );
}

// ===== OVERVIEW =====
function OverviewTab({ project, members, setTab }: { project: Project; members: ProjectDetail["members"]; setTab: (t: string) => void }) {
  const { data: scenes } = useQuery<Scene[]>({ queryKey: ["/api/projects", project.id, "scenes"] });
  const d = formatDeadline(project.deadline);
  const total = scenes?.length || 0;
  const done = scenes?.filter((s) => s.status === "done").length || 0;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Stat title="Deadline" value={d.text} sub={project.deadline ?? "Not set"} />
      <Stat title="Progress" value={`${pct}%`} sub={`${done} of ${total} scenes done`} />
      <Stat title="Team" value={String(members.length)} sub="collaborators" />

      <div className="md:col-span-3 rounded-xl border border-card-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">Pipeline</h3>
          <Button variant="ghost" size="sm" onClick={() => setTab("scenes")} data-testid="button-view-scenes">View all scenes</Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {STATUS_ORDER.map((s) => {
            const count = scenes?.filter((sc) => sc.status === s).length || 0;
            return (
              <div key={s} className="rounded-md border border-border p-3">
                <div className="text-2xl font-display font-bold mb-0.5">{count}</div>
                <div className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${statusClass(s)}`}>{STATUS_LABELS[s]}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="md:col-span-3 rounded-xl border border-card-border bg-card p-5">
        <h3 className="font-display font-semibold mb-3">Team</h3>
        <div className="flex flex-wrap gap-3">
          {members.map((m) => m.user && (
            <div key={m.id} className="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback style={{ backgroundColor: m.user.avatarColor, color: "white" }} className="text-xs font-semibold">
                  {initials(m.user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <div className="font-medium">{m.user.name}</div>
                <div className="text-[11px] text-muted-foreground capitalize">{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="md:col-span-3 rounded-xl border border-card-border bg-card p-5">
        <h3 className="font-display font-semibold mb-4 text-sm flex items-center gap-2">
          <ListChecks size={16} className="text-primary" /> Burndown Chart
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[
              { name: "Day 1", remaining: 100 },
              { name: "Day 2", remaining: 85 },
              { name: "Day 3", remaining: 70 },
              { name: "Day 4", remaining: 60 },
              { name: "Day 5", remaining: 45 },
              { name: "Day 6", remaining: 30 },
              { name: "Day 7", remaining: 15 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              />
              <Line type="monotone" dataKey="remaining" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{title}</div>
      <div className="font-display text-xl font-bold mb-0.5">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

// ===== SCRIPT =====
function ScriptTab({ projectId }: { projectId: number }) {
  const { data: scripts } = useQuery<Script[]>({ queryKey: ["/api/projects", projectId, "scripts"] });
  const [active, setActive] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ title: string; content: string }>({ title: "", content: "" });
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const [otherCursors, setOtherCursors] = useState<Record<number, number>>({});

  useEffect(() => {
    if (active === null && scripts && scripts.length > 0) {
      setActive(scripts[0].id);
    }
  }, [scripts, active]);

  const current = scripts?.find((s) => s.id === active) as Script & { sourceType?: string, sourceFormat?: string, originalKey?: string };
  useEffect(() => {
    if (current) setDraft({ title: current.title, content: current.content });
  }, [active, current?.id]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !projectId) return;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/api/projects/${projectId}/review-room?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "script-cursor") {
        setOtherCursors(prev => ({ ...prev, [msg.userId]: msg.pos }));
      }
    };
    return () => ws.close();
  }, [projectId]);

  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/projects/${projectId}/scripts`, { title: "New script", content: "# New script\n\nStart writing…" })).json(),
    onSuccess: (s: Script) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "scripts"] });
      setActive(s.id);
    },
  });
  const save = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/projects/${projectId}/scripts/${active}`, draft)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "scripts"] });
      toast({ title: "Script saved" });
    },
  });
  const del = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/projects/${projectId}/scripts/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "scripts"] });
      setActive(null);
    },
  });

  if (!scripts || scripts.length === 0) {
    return (
      <EmptyTabState
        icon={<FileText size={20} />}
        title="No scripts yet"
        body="Drafts, dialog, scene notes — write in markdown with a live preview."
        ctaLabel="New script"
        onCta={() => create.mutate()}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">
      <div className="rounded-xl border border-card-border bg-card p-3 h-fit">
        <Button variant="ghost" size="sm" className="w-full justify-start mb-2" onClick={() => create.mutate()} data-testid="button-new-script">
          <Plus size={14} className="mr-1.5" />New script
        </Button>
        <div className="space-y-0.5">
          {scripts.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`w-full text-left text-sm px-2.5 py-1.5 rounded hover-elevate ${active === s.id ? "bg-accent font-medium" : ""}`}
              data-testid={`button-script-${s.id}`}
            >
              <span className="truncate block">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {current && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="font-display text-base font-semibold"
              data-testid="input-script-title"
              disabled={current.sourceType === "upload"}
            />
            {current.sourceType === "upload" && (
              <span className="text-[10px] px-2 py-1 rounded bg-muted/50 text-muted-foreground font-medium uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Upload size={10} /> Uploaded
              </span>
            )}
          </div>
          
          {current.sourceType === "upload" ? (
            <div className="rounded-md border border-border bg-background p-4 min-h-[32rem] max-h-[70vh] overflow-auto prose-cel">
              {current.sourceFormat === "pdf" ? (
                <div className="flex flex-col items-center min-w-full">
                  <Document
                    file={draft.content}
                    error={<div className="p-4 text-sm whitespace-pre-wrap font-mono">{draft.content}</div>}
                    loading={<Loader2 className="animate-spin text-muted-foreground my-8" />}
                  >
                    <Page pageNumber={1} renderTextLayer={false} renderAnnotationLayer={false} className="shadow-sm border" width={Math.min(window.innerWidth - 300, 800)} />
                  </Document>
                  <p className="text-xs text-muted-foreground mt-4 italic text-center">First page preview. Original text available below.</p>
                  <div className="mt-8 pt-8 border-t border-border w-full text-sm whitespace-pre-wrap font-mono opacity-80">
                    {draft.content}
                  </div>
                </div>
              ) : current.sourceFormat === "docx" ? (
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(draft.content, { FORBID_TAGS: ['script', 'iframe'], FORBID_ATTR: ['onerror', 'onload', 'onclick'] }) }} />
              ) : (
                <ReactMarkdown>{draft.content}</ReactMarkdown>
              )}
            </div>
          ) : (
            <>
              <div className="relative">
                <Textarea
                  value={draft.content}
                  onChange={(e) => {
                    setDraft({ ...draft, content: e.target.value });
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ type: "script-cursor", pos: e.target.selectionStart }));
                    }
                  }}
                  rows={22}
                  className="font-mono text-sm leading-relaxed"
                  placeholder="Write your script in markdown…"
                  data-testid="input-script-content"
                />
                <div className="absolute top-0 right-0 p-2 pointer-events-none">
                  {Object.entries(otherCursors).map(([uid, pos]) => (
                    <div key={uid} className="text-[10px] bg-primary text-primary-foreground px-1 rounded animate-pulse">
                      User {uid} is editing...
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-border bg-background px-4 py-3 prose-cel text-sm overflow-auto" style={{ maxHeight: "32rem" }}>
                <ReactMarkdown>{draft.content || "*Preview will appear here.*"}</ReactMarkdown>
              </div>
            </>
          )}

          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive" data-testid="button-delete-script">
                    <Trash2 size={14} className="mr-1.5" />Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this script?</AlertDialogTitle>
                    <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => del.mutate(active!)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              {current.sourceType === "upload" && current.originalKey && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/projects/${projectId}/scripts/${current.id}/original`, {
                        headers: { "Authorization": `Bearer ${getAuthToken()}` }
                      });
                      const data = await res.json();
                      if (data.url) window.open(data.url, '_blank');
                    } catch (e) {
                      toast({ title: "Failed to download", variant: "destructive" });
                    }
                  }}
                >
                  <Download size={14} className="mr-1.5" /> Download original
                </Button>
              )}

              {/* v4: AI shot suggest */}
              {current.sourceType !== "upload" && <V4ScriptAiButton projectId={projectId} scriptContent={draft.content} />}
              {/* === AGENT_3 ADDITIONS START === */}
              {current.sourceType !== "upload" && <LoreSafeChecklist projectId={projectId} scriptContent={draft.content} />}
              {/* === AGENT_3 ADDITIONS END === */}
            </div>
            
            {current.sourceType !== "upload" && (
              <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-script">
                {save.isPending ? "Saving…" : "Save script"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== STORYBOARDS =====
function StoryboardsTab({ projectId }: { projectId: number }) {
  const { data: boards } = useQuery<(Storyboard & { panels: Panel[] })[]>({
    queryKey: ["/api/projects", projectId, "storyboards"],
  });
  const [activeId, setActiveId] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (activeId === null && boards && boards.length > 0) setActiveId(boards[0].id);
  }, [boards, activeId]);

  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/projects/${projectId}/storyboards`, { title: "New storyboard" })).json(),
    onSuccess: (sb: Storyboard) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storyboards"] });
      setActiveId(sb.id);
    },
  });
  const del = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/projects/${projectId}/storyboards/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storyboards"] });
      setActiveId(null);
    },
  });

  if (!boards || boards.length === 0) {
    return (
      <EmptyTabState
        icon={<ImageIcon size={20} />}
        title="No storyboards yet"
        body="Upload reference frames, sketch boards, or shot blocks. Drag to reorder."
        ctaLabel="New storyboard"
        onCta={() => create.mutate()}
      />
    );
  }

  const current = boards.find((b) => b.id === activeId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveId(b.id)}
              className={`text-sm px-3 py-1.5 rounded-md border whitespace-nowrap hover-elevate ${
                activeId === b.id ? "bg-accent border-foreground/20 font-medium" : "border-border"
              }`}
              data-testid={`button-storyboard-${b.id}`}
            >
              {b.title}{" "}
              <span className="text-muted-foreground text-xs">({b.panels.length})</span>
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => create.mutate()} data-testid="button-new-storyboard">
          <Plus size={14} className="mr-1.5" />New storyboard
        </Button>
      </div>

      {current && (
        <StoryboardView
          board={current}
          projectId={projectId}
          onDelete={() => del.mutate(current.id)}
        />
      )}
    </div>
  );
}

function StoryboardView({ board, projectId, onDelete }: { board: Storyboard & { panels: Panel[] }; projectId: number; onDelete: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [panels, setPanels] = useState<Panel[]>(board.panels);
  const [reviewing, setReviewing] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setPanels(board.panels); }, [board.id, board.panels.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const upload = useMutation({
    mutationFn: async (data: { imageData: string; caption: string }) => {
      const r = await apiRequest("POST", `/api/storyboards/${board.id}/panels`, data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storyboards"] });
    },
    onError: (err: any) => toast({ title: "Upload failed", description: String(err.message || err), variant: "destructive" }),
  });

  const reorder = useMutation({
    mutationFn: async (newOrder: Panel[]) => {
      await Promise.all(newOrder.map((p, i) => apiRequest("PATCH", `/api/panels/${p.id}`, { orderIdx: i })));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storyboards"] }),
  });

  const delPanel = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/panels/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storyboards"] }),
  });

  const editPanel = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Panel> }) =>
      (await apiRequest("PATCH", `/api/panels/${id}`, patch)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storyboards"] }),
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 10MB.`, variant: "destructive" });
        continue;
      }
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      await upload.mutateAsync({ imageData: data, caption: file.name });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = panels.findIndex((p) => p.id === active.id);
    const newIdx = panels.findIndex((p) => p.id === over.id);
    const next = arrayMove(panels, oldIdx, newIdx);
    setPanels(next);
    reorder.mutate(next);
  };

  return (
    <>
    {reviewing && panels.length > 0 && (
      <StoryboardReviewer panels={panels} onClose={() => setReviewing(false)} />
    )}
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold">{board.title}</h3>
        <div className="flex gap-2">
          {panels.length > 0 && (
            <GlassButton
              variant="primary"
              size="sm"
              onClick={() => setReviewing(true)}
              data-testid="button-review-storyboard"
            >
              <Presentation size={13} className="mr-1" /> Review
            </GlassButton>
          )}
          <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} data-testid="input-upload-panel" />
          {/* v4: sketch button */}
          <V4SketchButton storyboardId={board.id} projectId={projectId} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="button-upload-panels">
            <Upload size={14} className="mr-1.5" />{uploading ? "Uploading…" : "Upload panels"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive" data-testid="button-delete-storyboard">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {panels.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg py-12 text-center text-sm text-muted-foreground">
          No panels yet. Click <span className="font-medium text-foreground">Upload panels</span> to add images.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={panels.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {panels.map((p, i) => (
                <SortablePanel
                  key={p.id}
                  panel={p}
                  index={i}
                  onDelete={() => delPanel.mutate(p.id)}
                  onEdit={(patch) => editPanel.mutate({ id: p.id, patch })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
    </>
  );
}

function SortablePanel({ panel, index, onDelete, onEdit }: { panel: Panel; index: number; onDelete: () => void; onEdit: (patch: Partial<Panel>) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: panel.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [caption, setCaption] = useState(panel.caption);

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-border bg-background overflow-hidden group" data-testid={`panel-${panel.id}`}>
      <div {...attributes} {...listeners} className="aspect-video bg-muted relative cursor-grab active:cursor-grabbing">
        <img
          src={panel.imageData}
          alt={panel.caption || panel.dialogue || `Storyboard panel ${index + 1}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 left-2 text-[10px] font-mono bg-background/90 px-1.5 py-0.5 rounded">
          #{String(index + 1).padStart(2, "0")}
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-1.5 right-1.5 h-7 w-7 bg-background/90 opacity-0 group-hover:opacity-100 text-destructive"
          data-testid={`button-delete-panel-${panel.id}`}
        >
          <X size={14} />
        </Button>
      </div>
      <div className="p-3 space-y-2">
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== panel.caption && onEdit({ caption })}
          className="text-xs h-8"
          placeholder="Caption…"
          data-testid={`input-caption-${panel.id}`}
        />
        {panel.dialogue && <div className="text-xs italic text-muted-foreground">"{panel.dialogue}"</div>}
        {/* v4: pin layer */}
        <V4PanelPinLayer panelId={panel.id} />
      </div>
    </div>
  );
}

// ===== ANIMATICS =====
// ── v4: AnimaticEditorSection ─────────────────────────────────────────────
function AnimaticEditorSection({ projectId }: { projectId: number }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  interface AnimaticProjectBasic { id: number; projectId: number; title: string; fps: number; totalDurationMs: number; createdAt: string; }
  const { data: animatics } = useQuery<AnimaticProjectBasic[]>({
    queryKey: ["/api/projects", projectId, "animatics-v2"],
    queryFn: async () => (await apiRequest("GET", `/api/projects/${projectId}/animatics-v2`)).json(),
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/animatics-v2`, {
        title: "New Animatic",
        fps: 24,
        totalDurationMs: 8000,
      });
      return res.json();
    },
    onSuccess: (ap: AnimaticProjectBasic) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "animatics-v2"] });
      navigate(`/projects/${projectId}/animatic/${ap.id}`);
    },
    onError: (e: any) => toast({ title: "Failed", description: String(e.message || e), variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/animatics-v2/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "animatics-v2"] }),
  });

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="mb-6">
      {/* v4: animatic */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Film size={15} className="text-primary" />
          <h3 className="font-display font-semibold text-sm">Multi-track Animatic Editor</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary/80 font-medium uppercase tracking-wider">NEW</span>
        </div>
        <Button
          size="sm"
          onClick={() => create.mutate()}
          disabled={create.isPending}
          data-testid="button-create-animatic-editor"
        >
          {create.isPending ? <><Loader2 size={12} className="animate-spin mr-1.5" />Creating…</> : <><Plus size={12} className="mr-1.5" />New Editor Animatic</>}
        </Button>
      </div>

      {animatics && animatics.length > 0 ? (
        <div className="space-y-2">
          {animatics.map((ap) => (
            <div
              key={ap.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-card-border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Film size={14} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{ap.title}</p>
                  <p className="text-xs text-muted-foreground">{ap.fps}fps · {formatDuration(ap.totalDurationMs)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => navigate(`/projects/${projectId}/animatic/${ap.id}`)}
                  data-testid={`button-open-animatic-editor-${ap.id}`}
                >
                  <ExternalLink size={12} className="mr-1.5" />
                  Open Editor
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => del.mutate(ap.id)}
                  data-testid={`button-delete-animatic-v2-${ap.id}`}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/2 px-6 py-5 text-center">
          <p className="text-sm text-muted-foreground">
            No multi-track animatics yet.
            Click <strong>New Editor Animatic</strong> to open the timeline editor.
          </p>
        </div>
      )}
    </div>
  );
}

function AnimaticsTab({ projectId }: { projectId: number }) {
  const { data: items } = useQuery<Animatic[]>({ queryKey: ["/api/projects", projectId, "animatics"] });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const create = useMutation({
    mutationFn: async (data: { title: string; videoData: string; notes: string }) =>
      (await apiRequest("POST", `/api/projects/${projectId}/animatics`, data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "animatics"] });
      setOpen(false); setTitle(""); setUrl(""); setNotes("");
      toast({ title: "Animatic added" });
    },
    onError: (err: any) => toast({ title: "Failed", description: String(err.message || err), variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/projects/${projectId}/animatics/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "animatics"] }),
  });

  const handleFile = async (f: File) => {
    if (f.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB. Try a YouTube/Vimeo URL.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });
    await create.mutateAsync({ title: title || f.name, videoData: data, notes });
    setUploading(false);
  };

  return (
    <div className="space-y-5">
      {/* v4: animatic editor section always shown at top */}
      <AnimaticEditorSection projectId={projectId} />

      {/* Legacy animatics (video uploads / YouTube) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-sm text-muted-foreground">Legacy Video Animatics</h3>
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)} data-testid="button-add-animatic">
            <Plus size={14} className="mr-1.5" />Add video
          </Button>
        </div>
        {(!items || items.length === 0) ? (
          <p className="text-sm text-muted-foreground">No video animatics yet.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {items.map((a) => <AnimaticCard key={a.id} a={a} onDelete={() => del.mutate(a.id)} />)}
          </div>
        )}
      </div>

      <AddAnimaticDialog
        open={open}
        setOpen={setOpen}
        title={title} setTitle={setTitle}
        url={url} setUrl={setUrl}
        notes={notes} setNotes={setNotes}
        fileRef={fileRef}
        uploading={uploading}
        onSubmit={() => {
          if (url) create.mutate({ title: title || "Animatic", videoData: url, notes });
        }}
        onFile={handleFile}
      />
    </div>
  );
}

function AnimaticCard({ a, onDelete }: { a: Animatic; onDelete: () => void }) {
  const yt = youTubeId(a.videoData);
  const vm = vimeoId(a.videoData);
  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden">
      <div className="aspect-video bg-black">
        {yt ? (
          <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${yt}`} title={a.title} allowFullScreen />
        ) : vm ? (
          <iframe className="w-full h-full" src={`https://player.vimeo.com/video/${vm}`} title={a.title} allowFullScreen />
        ) : a.videoData.startsWith("data:") ? (
          <video controls src={a.videoData} className="w-full h-full" />
        ) : a.videoData.startsWith("http") ? (
          <video controls src={a.videoData} className="w-full h-full" />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No video</div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-1.5">
          <h4 className="font-display font-semibold text-sm">{a.title}</h4>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} data-testid={`button-delete-animatic-${a.id}`}>
            <Trash2 size={13} />
          </Button>
        </div>
        {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
      </div>
    </div>
  );
}

interface AddAnimaticDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  title: string;
  setTitle: (title: string) => void;
  url: string;
  setUrl: (url: string) => void;
  notes: string;
  setNotes: (notes: string) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  uploading: boolean;
  onSubmit: () => void;
  onFile: (file: File) => void;
}

function AddAnimaticDialog(props: AddAnimaticDialogProps) {
  const { open, setOpen, title, setTitle, url, setUrl, notes, setNotes, fileRef, uploading, onSubmit, onFile } = props;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Add animatic</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="Rough cut v1" data-testid="input-animatic-title" />
          </div>
          <div className="space-y-1.5">
            <Label>YouTube or Vimeo URL</Label>
            <Input value={url} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" data-testid="input-animatic-url" />
          </div>
          <div className="text-xs text-muted-foreground text-center">or</div>
          <div>
            <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e: React.ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && onFile(e.target.files[0])} data-testid="input-upload-animatic" />
            <Button variant="outline" type="button" className="w-full" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="button-upload-animatic">
              <Upload size={14} className="mr-1.5" />{uploading ? "Uploading…" : "Upload video file (≤10MB)"}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)} rows={2} placeholder="Optional notes" data-testid="input-animatic-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!url} data-testid="button-save-animatic">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== SCENES =====
function ScenesTab({ projectId }: { projectId: number }) {
  const { data: scenes } = useQuery<Scene[]>({ queryKey: ["/api/projects", projectId, "scenes"] });
  const { toast } = useToast();
  const [view, setView] = useState<"table" | "kanban" | "gantt">("table");
  const [open, setOpen] = useState(false);

  const sorted = [...(scenes || [])].sort((a, b) =>
    (a.deadline || "9999").localeCompare(b.deadline || "9999"),
  );

  if (!scenes || scenes.length === 0) {
    return (
      <>
        <EmptyTabState
          icon={<ListChecks size={20} />}
          title="No scenes yet"
          body="Track each shot through your pipeline: script → storyboard → animatic → final → done."
          ctaLabel="New scene"
          onCta={() => setOpen(true)}
        />
        <NewSceneDialog open={open} setOpen={setOpen} projectId={projectId} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 rounded-md border border-border p-0.5 bg-card">
          <button
            onClick={() => setView("table")}
            className={`text-xs px-3 py-1 rounded ${view === "table" ? "bg-accent font-medium" : ""}`}
            data-testid="button-view-table"
          >Table</button>
          <button
            onClick={() => setView("kanban")}
            className={`text-xs px-3 py-1 rounded ${view === "kanban" ? "bg-accent font-medium" : ""}`}
            data-testid="button-view-kanban"
          >Kanban</button>
          <button
            onClick={() => setView("gantt")}
            className={`text-xs px-3 py-1 rounded ${view === "gantt" ? "bg-accent font-medium" : ""}`}
            data-testid="button-view-gantt"
          >Gantt</button>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            id="csv-import"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const lines = text.split("\n").filter(l => l.trim());
              // Skip header if it exists
              const startIdx = lines[0].toLowerCase().includes("number") ? 1 : 0;
              for (let i = startIdx; i < lines.length; i++) {
                const [num, title, status, deadline] = lines[i].split(",").map(s => s?.trim());
                if (num && title) {
                  await apiRequest("POST", `/api/projects/${projectId}/scenes`, {
                    number: num, title, status: status || "script", deadline: deadline || null
                  });
                }
              }
              queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "scenes"] });
              toast({ title: "Imported shots", description: `Added ${lines.length - startIdx} scenes.` });
            }}
          />
          <Button variant="outline" size="sm" onClick={() => document.getElementById("csv-import")?.click()} data-testid="button-import-csv">
            <Upload size={14} className="mr-1.5" />Import CSV
          </Button>
          <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-scene">
            <Plus size={14} className="mr-1.5" />New scene
          </Button>
        </div>
      </div>

      {view === "table" ? <ScenesTable scenes={sorted} projectId={projectId} /> : 
       view === "kanban" ? <ScenesKanban scenes={sorted} projectId={projectId} /> : 
       <ScenesGantt scenes={sorted} projectId={projectId} />}
      <NewSceneDialog open={open} setOpen={setOpen} projectId={projectId} />
    </div>
  );
}

function ScenesTable({ scenes, projectId }: { scenes: Scene[]; projectId: number }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Scene> }) =>
      (await apiRequest("PATCH", `/api/projects/${projectId}/scenes/${id}`, patch)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "scenes"] }),
  });
  const del = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/projects/${projectId}/scenes/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "scenes"] }),
  });

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2.5 w-8"></th>
              <th className="text-left px-4 py-2.5 font-medium">#</th>
              <th className="text-left px-4 py-2.5 font-medium">Title</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 font-medium">Deadline</th>
              <th className="text-left px-4 py-2.5 font-medium">Timer</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
            {scenes.map((s) => {
              const d = formatDeadline(s.deadline);
              const tone = d.tone === "red" ? "text-destructive" : d.tone === "amber" ? "text-amber-600 dark:text-amber-400" : d.tone === "green" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";
              const isExp = expanded.has(s.id);
              return (
                <tbody key={s.id}>
                  <tr className="border-b border-border" data-testid={`row-scene-${s.id}`}>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => toggleExpand(s.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        data-testid={`button-expand-scene-${s.id}`}
                      >
                        {isExp ? <ChevronDown size={13} /> : <ChevronRightIcon size={13} />}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{s.number}</td>
                    <td className="px-4 py-2.5">
                      <input
                        defaultValue={s.title}
                        onBlur={(e) => e.target.value !== s.title && update.mutate({ id: s.id, patch: { title: e.target.value } })}
                        className="bg-transparent outline-none w-full focus:bg-background focus:px-2 focus:py-0.5 focus:rounded -ml-2 px-2 py-0.5"
                        data-testid={`input-scene-title-${s.id}`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Select value={s.status} onValueChange={(v) => update.mutate({ id: s.id, patch: { status: v } })}>
                        <SelectTrigger className="h-7 w-32 text-xs" data-testid={`select-status-${s.id}`}>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${statusClass(s.status)}`}>
                            {STATUS_LABELS[s.status]}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_ORDER.map((st) => (
                            <SelectItem key={st} value={st}>{STATUS_LABELS[st]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className={`px-4 py-2.5 text-xs ${tone}`}>{d.text}</td>
                    <td className="px-4 py-2.5">
                      {/* v4: scene timer */}
                      <SceneTimerButton sceneId={s.id} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => del.mutate(s.id)} data-testid={`button-delete-scene-${s.id}`}>
                        <Trash2 size={13} />
                      </Button>
                    </td>
                  </tr>
                  {isExp && (
                    <tr className="border-b border-border bg-muted/20">
                      <td colSpan={7} className="px-6 py-3">
                        <SceneRendersPanel sceneId={s.id} />
                        {/* v4: timer breakdown + tags */}
                        <div className="mt-3 pt-3 border-t border-border">
                          <V4SceneExtras scene={s} />
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
        </table>
      </div>
    </div>
  );
}

const RENDER_STATUSES = ["queued", "running", "done", "failed"];
const RENDER_STATUS_COLORS: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-amber-500/15 text-amber-500",
  done: "bg-emerald-500/15 text-emerald-500",
  failed: "bg-red-500/15 text-red-500",
};
const SOFTWARES = ["Blender", "Moho", "After Effects", "Other"];

function formatDuration(sec: number | null | undefined): string {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SceneRendersPanel({ sceneId }: { sceneId: number }) {
  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("queued");
  const [software, setSoftware] = useState("Blender");
  const [durationStr, setDurationStr] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const { data: renders, isLoading } = useQuery<Render[]>({
    queryKey: ["/api/scenes", sceneId, "renders"],
    queryFn: async () => (await apiRequest("GET", `/api/scenes/${sceneId}/renders`)).json(),
  });

  const create = useMutation({
    mutationFn: async () => {
      const parts = durationStr.split(":").map(Number);
      let durationSeconds: number | null = null;
      if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1];
      const r = await apiRequest("POST", `/api/scenes/${sceneId}/renders`, {
        label: label || "Render", status, software, durationSeconds, fileUrl, notes,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenes", sceneId, "renders"] });
      setAddOpen(false);
      setLabel(""); setStatus("queued"); setSoftware("Blender"); setDurationStr(""); setFileUrl(""); setNotes("");
      toast({ title: "Render added" });
    },
  });

  const del = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/renders/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/scenes", sceneId, "renders"] }),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Monitor size={11} /> Renders
        </span>
        <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)} className="h-6 text-xs px-2" data-testid={`button-add-render-${sceneId}`}>
          <Plus size={11} className="mr-1" /> Add render
        </Button>
      </div>

      {isLoading && <div className="h-8 bg-muted rounded animate-pulse" />}

      {renders && renders.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No renders yet.</p>
      )}

      {renders && renders.map((r) => (
        <div key={r.id} className="flex items-center gap-3 text-xs" data-testid={`render-row-${r.id}`}>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${RENDER_STATUS_COLORS[r.status] || "bg-muted text-muted-foreground"}`}>
            {r.status}
          </span>
          <span className="font-medium">{r.label}</span>
          <span className="text-muted-foreground">{r.software}</span>
          {r.durationSeconds && <span className="font-mono text-muted-foreground">{formatDuration(r.durationSeconds)}</span>}
          {r.notes && <span className="text-muted-foreground truncate max-w-xs">{r.notes}</span>}
          {r.fileUrl && (
            <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-0.5 ml-auto">
              <ExternalLink size={11} />
            </a>
          )}
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive ml-auto" onClick={() => del.mutate(r.id)}>
            <Trash2 size={11} />
          </Button>
        </div>
      ))}

      {/* Add render dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add render</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="v3 final" data-testid="input-render-label" />
              </div>
              <div className="space-y-1.5">
                <Label>Software</Label>
                <Select value={software} onValueChange={setSoftware}>
                  <SelectTrigger data-testid="select-render-software"><SelectValue /></SelectTrigger>
                  <SelectContent>{SOFTWARES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger data-testid="select-render-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{RENDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Duration (HH:MM:SS)</Label>
                <Input value={durationStr} onChange={(e) => setDurationStr(e.target.value)} placeholder="0:04:22" data-testid="input-render-duration" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>File URL</Label>
              <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" data-testid="input-render-url" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" data-testid="input-render-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <GlassButton variant="primary" size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add render"}
            </GlassButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScenesGantt({ scenes, projectId }: { scenes: Scene[]; projectId: number }) {
  const sorted = [...scenes].filter(s => s.deadline).sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""));
  if (sorted.length === 0) return <div className="p-10 text-center text-muted-foreground border border-dashed rounded-lg">No scenes with deadlines to show in Gantt.</div>;

  const minDate = new Date(sorted[0].deadline!);
  const maxDate = new Date(sorted[sorted.length - 1].deadline!);
  const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24)) + 7);

  return (
    <div className="rounded-xl border border-card-border bg-card p-5 overflow-x-auto">
      <div className="min-w-[800px] space-y-4">
        {sorted.map((s) => {
          const d = new Date(s.deadline!);
          const offset = Math.max(0, Math.ceil((d.getTime() - minDate.getTime()) / (1000 * 3600 * 24)));
          return (
            <div key={s.id} className="flex items-center gap-4">
              <div className="w-32 text-xs font-medium truncate">{s.number}: {s.title}</div>
              <div className="flex-1 bg-muted/30 h-6 rounded-full relative overflow-hidden">
                <div 
                  className={`absolute h-full rounded-full ${statusClass(s.status)} opacity-80 border border-white/20`}
                  style={{ 
                    left: `${(offset / totalDays) * 100}%`, 
                    width: "15%", // Fixed width for simplicity in this mockup
                    minWidth: "40px"
                  }}
                >
                  <div className="px-2 py-0.5 text-[9px] font-bold truncate text-white">{STATUS_LABELS[s.status]}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScenesKanban({ scenes, projectId }: { scenes: Scene[]; projectId: number }) {
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Scene> }) =>
      (await apiRequest("PATCH", `/api/projects/${projectId}/scenes/${id}`, patch)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "scenes"] }),
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {STATUS_ORDER.map((st) => {
        const items = scenes.filter((s) => s.status === st);
        return (
          <div key={st} className="rounded-lg border border-border bg-card p-3 min-h-[12rem]">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${statusClass(st)}`}>{STATUS_LABELS[st]}</span>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((s) => (
                <div key={s.id} className="rounded-md border border-border bg-background p-2.5 hover-elevate cursor-pointer" data-testid={`kanban-card-${s.id}`}>
                  <div className="font-mono text-[10px] text-muted-foreground mb-0.5">{s.number}</div>
                  <div className="text-sm font-medium leading-snug">{s.title}</div>
                  <div className="mt-2">
                    <Select value={s.status} onValueChange={(v) => update.mutate({ id: s.id, patch: { status: v } })}>
                      <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_ORDER.map((sx) => <SelectItem key={sx} value={sx}>{STATUS_LABELS[sx]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="text-[11px] text-muted-foreground italic">Empty</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NewSceneDialog({ open, setOpen, projectId }: { open: boolean; setOpen: (b: boolean) => void; projectId: number }) {
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("script");
  const [deadline, setDeadline] = useState("");
  const create = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/projects/${projectId}/scenes`, {
        number, title, status, deadline: deadline || null,
      })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "scenes"] });
      setOpen(false); setNumber(""); setTitle(""); setStatus("script"); setDeadline("");
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">New scene</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Number</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="1A" data-testid="input-scene-number" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-new-scene-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((sx) => <SelectItem key={sx} value={sx}>{STATUS_LABELS[sx]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bingo enters the loungeroom" data-testid="input-scene-new-title" />
          </div>
          <div className="space-y-1.5">
            <Label>Deadline</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} data-testid="input-scene-new-deadline" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!title} data-testid="button-create-scene">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== COMMENTS =====
function CommentsTab({ projectId }: { projectId: number }) {
  const { data: comments } = useQuery<any[]>({ queryKey: ["/api/projects", projectId, "comments"] });
  const [body, setBody] = useState("");

  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/projects/${projectId}/comments`, { body })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "comments"] });
      setBody("");
    },
  });
  const del = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/projects/${projectId}/comments/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "comments"] }),
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="rounded-xl border border-card-border bg-card p-4">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Leave a note for your team…"
          rows={3}
          className="resize-none border-0 focus-visible:ring-0 px-0"
          data-testid="input-comment-body"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => create.mutate()} disabled={!body.trim() || create.isPending} data-testid="button-post-comment">Post</Button>
        </div>
      </div>

      <div className="space-y-3">
        {comments && comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">No comments yet. Start the conversation.</p>
        )}
        {comments?.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-card p-4" data-testid={`comment-${c.id}`}>
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback style={{ backgroundColor: c.author?.avatarColor || "#888", color: "white" }} className="text-xs font-semibold">
                  {c.author ? initials(c.author.name) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-sm font-medium">{c.author?.name || "Unknown"}</div>
                  <span className="text-[11px] text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => del.mutate(c.id)}>
                <Trash2 size={12} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== SETTINGS =====
function SettingsTab({ project, members }: { project: Project; members: ProjectDetail["members"] }) {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [deadline, setDeadline] = useState(project.deadline || "");
  const [shareEnabled, setShareEnabled] = useState(project.shareEnabled);
  const [inviteEmail, setInviteEmail] = useState("");
  const { toast } = useToast();

  const patch = useMutation({
    mutationFn: async (data: Partial<Project>) => (await apiRequest("PATCH", `/api/projects/${project.id}`, data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  // === AGENT_5 ADDITIONS START ===
  const [discordWebhook, setDiscordWebhook] = useState((project as any).dltDiscordWebhookUrl || "");
  const testDiscord = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/${project.id}/discord/test`, {});
    },
    onSuccess: () => toast({ title: "Test message sent to Discord" }),
    onError: (err) => toast({ title: "Failed to send", description: String(err), variant: "destructive" }),
  });
  // === AGENT_5 ADDITIONS END ===
  const del = useMutation({
    mutationFn: async () => (await apiRequest("DELETE", `/api/projects/${project.id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setLocation("/dashboard");
    },
  });
  const invite = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/projects/${project.id}/members`, { email: inviteEmail })).json(),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      setInviteEmail("");
      if (data?.tempPassword) {
        toast({ title: "Invited & created", description: `Temp password for ${data.user.email}: ${data.tempPassword}` });
      } else {
        toast({ title: "Member added" });
      }
    },
    onError: (err: any) => toast({ title: "Couldn't invite", description: String(err.message || err), variant: "destructive" }),
  });
  const removeMember = useMutation({
    mutationFn: async (userId: number) =>
      (await apiRequest("DELETE", `/api/projects/${project.id}/members/${userId}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] }),
  });

  const shareUrl = `${window.location.origin}${window.location.pathname}#/share/${project.shareToken}`;

  return (
    <div className="space-y-5 max-w-2xl">
      <SettingsSection title="Project details">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-settings-title" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} data-testid="input-settings-description" />
          </div>
          <div className="space-y-1.5">
            <Label>Deadline</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} data-testid="input-settings-deadline" />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => patch.mutate({ title, description, deadline: deadline || null })} disabled={patch.isPending} data-testid="button-save-project">Save changes</Button>
          </div>
        </div>
      </SettingsSection>

      {/* === AGENT_1 ADDITIONS START === */}
      <CliBrandSettings project={project} />
      {/* === AGENT_1 ADDITIONS END === */}

      <SettingsSection title="Members">
        <div className="space-y-3">
          {members.map((m) => m.user && (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8">
                  <AvatarFallback style={{ backgroundColor: m.user.avatarColor, color: "white" }} className="text-xs font-semibold">
                    {initials(m.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{m.user.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.user.email} · {m.role}</div>
                </div>
              </div>
              {m.role !== "owner" && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMember.mutate(m.user!.id)} data-testid={`button-remove-${m.user.id}`}>
                  <X size={14} />
                </Button>
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input type="email" placeholder="someone@studio.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} data-testid="input-invite-email" />
            <Button onClick={() => invite.mutate()} disabled={!inviteEmail || invite.isPending} data-testid="button-invite">Invite</Button>
          </div>
        </div>
      </SettingsSection>

      {/* === AGENT_5 ADDITIONS START === */}
      <SettingsSection title="Discord Webhooks">
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground mb-2">Send event notifications to a Discord channel.</div>
          <div className="flex gap-2">
            <Input 
              type="text" 
              placeholder="https://discord.com/api/webhooks/..." 
              value={discordWebhook} 
              onChange={(e) => setDiscordWebhook(e.target.value)} 
            />
            <Button 
              onClick={() => patch.mutate({ dltDiscordWebhookUrl: discordWebhook })} 
              disabled={patch.isPending || discordWebhook === (project as any).dltDiscordWebhookUrl}
            >
              Save
            </Button>
            <Button 
              variant="secondary"
              onClick={() => testDiscord.mutate()} 
              disabled={!discordWebhook || testDiscord.isPending}
            >
              Test
            </Button>
          </div>
        </div>
      </SettingsSection>
      {/* === AGENT_5 ADDITIONS END === */}

      <SettingsSection title="Public share link">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Anyone with the link can view</div>
              <div className="text-xs text-muted-foreground">Read-only, no login. Great for clients & collaborators.</div>
            </div>
            <Switch checked={shareEnabled} onCheckedChange={(v) => { setShareEnabled(v); patch.mutate({ shareEnabled: v }); }} data-testid="switch-share" />
          </div>
          {shareEnabled && (
            <div className="flex items-center gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-xs" data-testid="input-share-url" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => { navigator.clipboard.writeText(shareUrl); toast({ title: "Link copied" }); }}
                data-testid="button-copy-share"
              >
                <Copy size={14} />
              </Button>
              <Button variant="outline" size="icon" asChild>
                <a href={`#/share/${project.shareToken}`} target="_blank" rel="noopener noreferrer" data-testid="link-view-share">
                  <Eye size={14} />
                </a>
              </Button>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* v4: AI key + Tags settings */}
      <AiKeySettings projectId={project.id} />
      <TagsSettings projectId={project.id} />

      {/* === AGENT_4 ADDITIONS START === */}
      <BakSettingsExports projectId={project.id} />
      {/* === AGENT_4 ADDITIONS END === */}

      <SettingsSection title="Danger zone" tone="destructive">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5" data-testid="button-delete-project">
              <Trash2 size={14} className="mr-1.5" />Delete this project
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this project?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes all scripts, storyboards, animatics, scenes, and comments. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Yes, delete project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "destructive" }) {
  return (
    <div className={`rounded-xl border ${tone === "destructive" ? "border-destructive/30" : "border-card-border"} bg-card p-5`}>
      <h3 className="font-display font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ===== SHARED EMPTY STATE =====
function EmptyTabState({ icon, title, body, ctaLabel, onCta }: { icon: React.ReactNode; title: string; body: string; ctaLabel: string; onCta: () => void }) {
  return (
    <div className="border border-dashed border-border rounded-xl py-12 px-6 flex flex-col items-center text-center bg-card">
      <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">{icon}</div>
      <h3 className="font-display font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-sm">{body}</p>
      <Button onClick={onCta}><Plus size={14} className="mr-1.5" />{ctaLabel}</Button>
    </div>
  );
}

// ===== v4 StoryboardView — Sketch Button =====
// We patch StoryboardView by modifying the Upload button row.
// The SketchModal integration: "Sketch" button opens a canvas that saves as a new panel.
// This is appended here as an augmentation. To inject into StoryboardView we edit inline below.

// v4: SortablePanel with pin mode (replaces original above via re-export is not possible,
// so we do direct edits in the functions below via the "v4 pin" inline integration approach).

// ===== v4 AI Shot Suggest =====
// Drawer that calls POST /api/projects/:id/shot-suggest with script content.
function AiShotSuggestSheet({ projectId, scriptContent, open, onOpenChange }: {
  projectId: number;
  scriptContent: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [suggestions, setSuggestions] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const suggest = async () => {
    if (!scriptContent.trim()) {
      toast({ title: "Write some script content first", variant: "destructive" });
      return;
    }
    setLoading(true);
    setSuggestions("");
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/ai/shot-suggest`, { scriptText: scriptContent });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to generate suggestions");
      
      let formatted = "";
      if (data.shots && data.shots.length > 0) {
        formatted = data.shots.map((s: any) => `${s.shotNumber}. ${s.shotType} - ${s.cameraMove}\n${s.actionDescription}`).join("\n\n");
      } else if (data.raw) {
        formatted = data.raw;
      }
      setSuggestions(formatted || "No suggestions returned.");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Auto-suggest when opened
  useEffect(() => {
    if (open && !suggestions && !loading) suggest();
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" /> AI Shot Suggestions
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            AI analyzes your script and suggests shot compositions, camera angles, and staging notes.
          </p>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Analyzing script…
            </div>
          )}
          {!loading && suggestions && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm prose-cel max-h-[60vh] overflow-auto">
              <ReactMarkdown>{suggestions}</ReactMarkdown>
            </div>
          )}
          {!loading && suggestions && (
            <div className="flex gap-2">
              <GlassButton variant="primary" size="sm" onClick={suggest} data-testid="button-ai-suggest-retry">
                <Sparkles size={13} className="mr-1.5" /> Regenerate
              </GlassButton>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  const lines = suggestions.split("\n").filter(l => l.trim().match(/^\d+\./));
                  for (const line of lines) {
                    const title = line.replace(/^\d+\.\s*/, "").trim();
                    await apiRequest("POST", `/api/projects/${projectId}/scenes`, {
                      number: line.match(/^\d+/)?.[0] || "1",
                      title: title.slice(0, 50),
                      status: "script"
                    });
                  }
                  queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "scenes"] });
                  toast({ title: "Shots created", description: `Added ${lines.length} shots to your list.` });
                  onOpenChange(false);
                }}
                data-testid="button-ai-insert-shots"
              >
                Insert as Shot List
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// v4 AI Key Settings section (for SettingsTab)
function AiKeySettings({ projectId }: { projectId: number }) {
  const [key, setKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const { toast } = useToast();

  const { data: status } = useQuery<{ hasKey: boolean; model: string | null } | null>({
    queryKey: ["/api/projects", projectId, "ai", "key"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/ai/key`);
      return await res.json();
    },
  });

  const { data: availableModels } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["openrouter-models"],
    queryFn: async () => {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models");
        const data = await res.json();
        // Sort by ID to group providers, filter a bit if needed or just return all
        return data.data || [];
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 60, // Cache for an hour
  });

  useEffect(() => {
    if (status?.hasKey && status.model) {
      setModel(status.model);
    }
  }, [status]);

  const saveKey = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/projects/${projectId}/ai/key`, { key, model })).json(),
    onSuccess: () => {
      toast({ title: "AI Settings saved" });
      setKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "ai", "key"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteKey = useMutation({
    mutationFn: async () => (await apiRequest("DELETE", `/api/projects/${projectId}/ai/key`)).json(),
    onSuccess: () => {
      toast({ title: "API key removed" });
      setKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "ai", "key"] });
    },
  });

  return (
    <SettingsSection title="AI Shot Suggest">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Add an <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline">OpenRouter API key</a> to enable AI shot suggestion in the Script tab.
        </p>
        {status?.hasKey ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-sm">
                <span className="text-muted-foreground font-mono text-xs">••••••••••••••••</span>
                <span className="ml-2 text-xs text-muted-foreground">· OpenRouter Key Saved</span>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteKey.mutate()} data-testid="button-delete-ai-key">
                <Trash2 size={13} />
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Model Selection</Label>
              <div className="flex gap-2">
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels?.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => saveKey.mutate()} disabled={saveKey.isPending || model === status?.model}>
                  Save Model
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="sk-or-v1-… (Enter OpenRouter API Key)"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              data-testid="input-ai-api-key"
            />
            <div className="space-y-2">
              <Label className="text-xs">Default Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent>
                  {availableModels?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => saveKey.mutate()} disabled={!key || saveKey.isPending} data-testid="button-save-ai-key">
              <KeyRound size={13} className="mr-1.5" />Save key & model
            </Button>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

// v4 Tags Settings section (for SettingsTab)
function TagsSettings({ projectId }: { projectId: number }) {
  return (
    <SettingsSection title="Project Tags">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Create color-coded tags to organize scenes and storyboards.</p>
        <TagsSettingsPanel />
      </div>
    </SettingsSection>
  );
}

// ===== v4 Enhanced SettingsTab wrapper =====
// This component renders after original SettingsTab via re-composition.
// We inject it by augmenting the ProjectWorkspace render with V4SettingsExtras.
export function V4SettingsExtras({ project }: { project: Project }) {
  return (
    <div className="space-y-5 max-w-2xl mt-5">
      <AiKeySettings projectId={project.id} />
      <TagsSettings projectId={project.id} />
    </div>
  );
}

// ===== v4 ScriptTab AI suggest button (exported for inline injection) =====
export function V4ScriptAiButton({ projectId, scriptContent }: { projectId: number; scriptContent: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <GlassButton
        variant="primary"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="button-ai-shot-suggest"
      >
        <Sparkles size={13} className="mr-1.5" /> Suggest shots
      </GlassButton>
      <AiShotSuggestSheet
        projectId={projectId}
        scriptContent={scriptContent}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

// ===== v4 Storyboard Sketch Button =====
export function V4SketchButton({ storyboardId, projectId }: { storyboardId: number; projectId: number }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="button-sketch-panel">
        <Pencil size={14} className="mr-1.5" />Sketch
      </Button>
      {open && <SketchModal storyboardId={storyboardId} projectId={projectId} onClose={() => setOpen(false)} />}
    </>
  );
}

// ===== v4 Panel Pin mode wrapper for SortablePanel =====
export function V4PanelPinLayer({ panelId }: { panelId: number }) {
  const [pinMode, setPinMode] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-1">
      <PinModeToggle panelId={panelId} pinMode={pinMode} onToggle={() => setPinMode((v) => !v)} />
      {pinMode && <PanelPinsOverlay panelId={panelId} pinMode={pinMode} />}
    </div>
  );
}

// === AGENT_4 ADDITIONS START ===
export function BakSceneGltfExport({ sceneId }: { sceneId: number }) {
  const { toast } = useToast();
  
  const handleGltfExport = async () => {
    try {
      const res = await apiRequest("POST", `/api/scenes/${sceneId}/gltf-stub`);
      const blob = await res.blob();
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `scene_${sceneId}_stub.gltf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objUrl);
      document.body.removeChild(a);
      toast({ title: "GLTF Exported" });
    } catch (e) {
      toast({ title: "Failed to export GLTF", variant: "destructive" });
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleGltfExport}>
      <Box className="w-3 h-3 mr-1" /> Export GLTF Stub
    </Button>
  );
}
// === AGENT_4 ADDITIONS END ===

// ===== v4 Scene expanded row extras =====
export function V4SceneExtras({ scene }: { scene: Scene }) {
  return (
    <div className="space-y-3">
      <SceneTimeBreakdown sceneId={scene.id} />
      <div className="mt-1">
        <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
          <Tag size={11} /> Tags
        </p>
        <InlineTagSelector entityKind="scene" entityId={scene.id} />
      </div>
      {/* === AGENT_4 ADDITIONS START === */}
      <div className="mt-2">
        <BakSceneGltfExport sceneId={scene.id} />
      </div>
      {/* === AGENT_4 ADDITIONS END === */}
    </div>
  );
}
