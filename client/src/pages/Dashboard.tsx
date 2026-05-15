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
import { GlassButton } from "@/components/ui/glass-button";
import { MetalGlassButton } from "@/components/ui/metal-glass-button";
import { Plus, Clapperboard, Calendar, ArrowRight, Sparkles, RotateCcw, BookOpen, Compass } from "lucide-react";
import { formatDeadline } from "@/lib/utils-cel";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";
import { getDailySketchPrompt, principleDrills } from "@/data/daily-drills";

const COLORS = ["#6E4FE8", "#E8744F", "#4FBFE8", "#E84F9F", "#4FE89A", "#E8C44F", "#E84F4F"];

export default function Dashboard() {
  const [useBibleTemplate, setUseBibleTemplate] = useState(false);
  const { data: projects, isLoading } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [promptOffset, setPromptOffset] = useState(0);
  const [principleIndex, setPrincipleIndex] = useState(new Date().getDate() % principleDrills.length);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const dailyPrompt = getDailySketchPrompt(new Date(), promptOffset);
  const activePrinciple = principleDrills[principleIndex];

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setOpen(false);
      setTitle(""); setDescription(""); setDeadline(""); setUseBibleTemplate(false);
      toast({ title: "Project created" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Sandbox project created" });
      setLocation(`/projects/${project.id}`);
    },
    onError: (err: any) => toast({ title: "Couldn't create sandbox", description: String(err.message || err), variant: "destructive" }),
  });

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-12 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-10 gap-4">
        <div>
          <p className="text-[11px] font-mono font-medium uppercase tracking-widest text-muted-foreground mb-2 opacity-70">
            Workspace
          </p>
          <h1 className="font-display text-xl font-bold tracking-tight">Projects</h1>
        </div>

        <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setUseBibleTemplate(false); }}>
          <DialogTrigger asChild>
            <MetalGlassButton variant="primary" size="pill" preset="silver" data-testid="button-new-project">
              <Plus size={15} className="mr-0.5" /> New project
            </MetalGlassButton>
          </DialogTrigger>
          <DialogContent className="glass-card border-0 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-display tracking-tight">Create a new project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Animation Project" data-testid="input-project-title" className="glass-input" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description (optional)" rows={3} data-testid="input-project-description" />
              </div>
              <div className="space-y-1.5">
                <Label>Deadline</Label>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} data-testid="input-project-deadline" className="glass-input" />
              </div>
              <div className="flex items-center space-x-2 rounded-lg border border-border/60 px-3 py-2.5">
                <Checkbox
                  id="use-bible-template"
                  checked={useBibleTemplate}
                  onCheckedChange={(checked) => setUseBibleTemplate(checked === true)}
                />
                <Label htmlFor="use-bible-template" className="text-sm font-normal cursor-pointer">
                  Seed project with Bible template
                </Label>
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        color === c ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      data-testid={`button-color-${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setOpen(false); setUseBibleTemplate(false); }}>Cancel</Button>
              <GlassButton
                variant="primary"
                size="sm"
                onClick={() => create.mutate()}
                disabled={!title || create.isPending}
                data-testid="button-create-project"
              >
                {create.isPending ? "Creating…" : "Create"}
              </GlassButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-2xl p-5 h-44 animate-pulse" />
              ))}
            </div>
          ) : projects && projects.length === 0 ? (
            <EmptyState onNew={() => setOpen(true)} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {projects?.map((p) => <ProjectCard key={p.id} p={p} />)}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <SandboxConstellation creating={createSandbox.isPending} onCreate={() => createSandbox.mutate()} />

          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  <Sparkles size={13} className="text-primary" />
                  Daily drill
                </div>
                <h2 className="font-display font-semibold mt-1">{dailyPrompt.title}</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPromptOffset((value) => value + 1)}
                data-testid="button-refresh-daily-prompt"
              >
                <RotateCcw size={14} />
              </Button>
            </div>
            <p className="text-sm leading-relaxed">{dailyPrompt.prompt}</p>
            <div className="mt-4 rounded-xl border border-card-border bg-white/40 p-3 text-xs text-muted-foreground dark:bg-white/5">
              {dailyPrompt.constraint}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
              <BookOpen size={13} className="text-primary" />
              12 principles
            </div>
            <h2 className="font-display font-semibold">{activePrinciple.principle}</h2>
            <div className="mt-1 text-xs text-muted-foreground">{activePrinciple.focus}</div>
            <p className="mt-4 text-sm leading-relaxed">{activePrinciple.exercise}</p>
            <PrincipleMotionDemo index={principleIndex} />
            <div className="mt-4 grid grid-cols-6 gap-1.5" aria-label="Principle drill picker">
              {principleDrills.map((drill, index) => (
                <button
                  key={drill.principle}
                  type="button"
                  aria-label={drill.principle}
                  onClick={() => setPrincipleIndex(index)}
                  className={`h-2.5 rounded-full transition-all ${
                    index === principleIndex ? "bg-primary" : "bg-muted-foreground/25 hover:bg-muted-foreground/40"
                  }`}
                  data-testid={`button-principle-${index}`}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function sandboxPanelDataUrl(index: number): string {
  const colors = ["#9DD0FF", "#E8C44F", "#4FE89A"];
  const title = ["OPEN", "TRY", "DONE"][index] || "CEL";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#10131a"/><rect x="140" y="110" width="1000" height="500" rx="28" fill="${colors[index % colors.length]}" opacity="0.18" stroke="${colors[index % colors.length]}" stroke-width="8"/><circle cx="${360 + index * 170}" cy="350" r="92" fill="${colors[index % colors.length]}"/><rect x="560" y="292" width="360" height="116" rx="16" fill="#ffffff" opacity="0.9"/><text x="740" y="365" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#10131a">${title}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function SandboxConstellation({ creating, onCreate }: { creating: boolean; onCreate: () => void }) {
  const nodes = ["Script", "Boards", "Compare", "Couch", "Palette", "Export"];
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <Compass size={13} className="text-primary" />
            Feature map
          </div>
          <h2 className="font-display font-semibold mt-1">Onboarding Sandbox</h2>
        </div>
      </div>
      <div className="relative mb-4 grid grid-cols-3 gap-2">
        {nodes.map((node, index) => (
          <div key={node} className="rounded-xl border border-card-border bg-white/45 p-3 text-center text-xs font-medium dark:bg-white/5">
            <div className="mx-auto mb-2 h-2.5 w-2.5 rounded-full bg-primary" style={{ opacity: 0.5 + index * 0.07 }} />
            {node}
          </div>
        ))}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Generate a throwaway project with sample script, panels, scenes, and bible data so every tool has something safe to chew on.
      </p>
      <Button className="w-full" onClick={onCreate} disabled={creating} data-testid="button-create-sandbox">
        {creating ? "Building sandbox..." : "Create Sandbox Project"}
      </Button>
    </div>
  );
}

function PrincipleMotionDemo({ index }: { index: number }) {
  const accent = index % 3 === 0 ? "#9DD0FF" : index % 3 === 1 ? "#E8C44F" : "#4FE89A";
  const scale = index % 4 === 0 ? ["scale-75", "scale-110", "scale-90", "scale-100"] : ["scale-100", "scale-95", "scale-105", "scale-100"];

  return (
    <div
      className="mt-4 grid h-20 grid-cols-4 items-end gap-2 rounded-xl border border-card-border bg-white/40 p-3 dark:bg-white/5"
      data-testid="principle-motion-demo"
      aria-label="Principle motion example"
    >
      {[0, 1, 2, 3].map((frame) => (
        <div key={frame} className="flex h-full items-end justify-center rounded-lg bg-background/60">
          <div
            className={`h-7 w-7 rounded-full transition-transform ${scale[frame]} ${frame === index % 4 ? "animate-bounce" : ""}`}
            style={{
              backgroundColor: accent,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.7), 0 8px 18px rgba(0,0,0,0.14)",
              animationDuration: "1.2s",
              animationDelay: `${frame * 90}ms`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function ProjectCard({ p }: { p: Project }) {
  const d = formatDeadline(p.deadline);
  const toneClass =
    d.tone === "red" ? "text-destructive" :
    d.tone === "amber" ? "text-amber-600 dark:text-amber-400" :
    d.tone === "green" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";

  return (
    <Link href={`/projects/${p.id}`}>
      <div
        className="glass-card group rounded-2xl p-5 cursor-pointer"
        data-testid={`card-project-${p.id}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center ring-1 ring-white/60"
            style={{ backgroundColor: p.coverColor + "20", color: p.coverColor }}
          >
            <Clapperboard size={18} />
          </div>
          {d.text !== "No deadline" && (
            <span className={`text-[11px] font-mono flex items-center gap-1 ${toneClass}`}>
              <Calendar size={11} />{d.text}
            </span>
          )}
        </div>
        <h3
          className="font-display text-base font-semibold mb-1.5 line-clamp-1 tracking-tight"
          data-testid={`text-project-title-${p.id}`}
        >
          {p.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-4 min-h-[2.2em] leading-relaxed">
          {p.description || "No description yet."}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span
            className="capitalize glass-status"
            style={{ backgroundColor: `${p.coverColor}15`, borderColor: `${p.coverColor}35`, color: p.coverColor }}
          >
            {p.status}
          </span>
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform opacity-50 group-hover:opacity-100" />
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="glass-card rounded-2xl py-20 px-6 flex flex-col items-center text-center">
      <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-5 ring-4 ring-primary/8">
        <Clapperboard size={22} />
      </div>
      <h3 className="font-display font-semibold mb-2 tracking-tight">No projects yet</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">
        Start by creating your first project. You'll get scripts, storyboards, animatics, and a scene tracker — all in one place.
      </p>
      <MetalGlassButton variant="primary" size="pill" preset="silver" onClick={onNew} data-testid="button-empty-new-project">
        <Plus size={15} className="mr-0.5" /> Create your first project
      </MetalGlassButton>
    </div>
  );
}
