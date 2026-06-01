import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CelLogo, CelWordmark } from "@/components/CelLogo";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown";
import { Film, FileText, Image as ImageIcon, ListChecks } from "lucide-react";
import {
  formatDeadline, statusClass, STATUS_LABELS, initials, youTubeId, vimeoId,
} from "@/lib/utils-cel";
import type { Project, Script, Animatic, Scene, Panel, Storyboard } from "@shared/schema";

import { CliVersionCompareModal } from "@/components/cli-version-compare";
import { CliShareHeader } from "@/components/cli-share-header";
import { CliFeedbackModal } from "@/components/cli-feedback-modal";
import { CliApprovalWidget } from "@/components/cli-approval-widget";
import { CliWatermarkOverlay } from "@/components/cli-watermark";
import { useState } from "react";

interface ShareData {
  project: Project;
  owner: { name: string; avatarColor: string } | null;
  scripts: Script[];
  storyboards: (Storyboard & { panels: Panel[] })[];
  animatics: Animatic[];
  scenes: Scene[];
}

export default function Share() {
  const params = useParams() as { token: string };
  const { data, isLoading, isError } = useQuery<ShareData>({
    queryKey: ["/api/share", params.token],
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="text-primary mb-4 flex justify-center"><CelLogo size={36} /></div>
          <h1 className="font-display text-xl font-bold mb-2">Link unavailable</h1>
          <p className="text-sm text-muted-foreground">
            This share link is disabled or doesn't exist. Ask the project owner for an updated link.
          </p>
        </div>
      </div>
    );
  }

  const { project, owner, scripts, storyboards, animatics, scenes } = data;
  const d = formatDeadline(project.deadline);
  const brandColor = (project as any).cli_brandColor || "#9DD0FF";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <style>{`
        .tabs-trigger-active {
          border-bottom-color: ${brandColor} !important;
          color: ${brandColor} !important;
        }
        [data-state="active"] {
          border-bottom-color: ${brandColor} !important;
          color: ${brandColor} !important;
        }
      `}</style>
      <CliShareHeader project={project} />
      {/* <header className="border-b border-border bg-sidebar">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <CelWordmark />
          <div className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            Read-only share
          </div>
        </div>
      </header> */}

      <main className="flex-1 max-w-5xl mx-auto w-full px-5 sm:px-8 py-10">
        <div className="mb-9">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project.coverColor }} />
                <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Animation project</span>
              </div>
              <h1 className="font-display text-xl font-bold tracking-tight mb-3" data-testid="text-share-title">{project.title}</h1>
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">{project.description || "No description."}</p>
              <div className="mt-4 flex items-center gap-4 flex-wrap text-xs">
                {owner && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback style={{ backgroundColor: owner.avatarColor, color: "white" }} className="text-[10px] font-semibold">
                        {initials(owner.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span>by <span className="font-medium text-foreground">{owner.name}</span></span>
                  </div>
                )}
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Deadline: {d.text}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 min-w-[200px]">
              <CliApprovalWidget projectId={project.id} phase="storyboard" brandColor={(project as any).cli_brandColor} />
              <CliApprovalWidget projectId={project.id} phase="animatic" brandColor={(project as any).cli_brandColor} />
              <CliFeedbackModal projectId={project.id} />
            </div>
          </div>
        </div>

        <Tabs defaultValue="script">
          <TabsList className="mb-6">
            <TabsTrigger value="script"><FileText size={14} className="mr-1.5" />Script</TabsTrigger>
            <TabsTrigger value="storyboard"><ImageIcon size={14} className="mr-1.5" />Storyboards</TabsTrigger>
            <TabsTrigger value="animatic"><Film size={14} className="mr-1.5" />Animatics</TabsTrigger>
            <TabsTrigger value="scenes"><ListChecks size={14} className="mr-1.5" />Scenes</TabsTrigger>
          </TabsList>

          <TabsContent value="script">
            <div className="space-y-6">
              {scripts.length === 0 && <Empty msg="No scripts shared." />}
              {scripts.map((s) => (
                <div key={s.id} className="rounded-xl border border-card-border bg-card p-6">
                  <h2 className="font-display font-semibold mb-3">{s.title}</h2>
                  <div className="prose-cel text-sm">
                    <ReactMarkdown>{s.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="storyboard">
            <div className="space-y-6">
              {storyboards.length === 0 && <Empty msg="No storyboards shared." />}
              {storyboards.map((sb) => (
                <div key={sb.id} className="rounded-xl border border-card-border bg-card p-6">
                  <h2 className="font-display font-semibold mb-4">{sb.title}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sb.panels.map((p, i) => (
                      <div key={p.id} className="rounded-lg border border-border overflow-hidden">
                        <div className="aspect-video bg-muted relative">
                           <img
                            src={p.imageData || undefined}
                            alt={p.caption || p.dialogue || `${sb.title} panel ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <CliWatermarkOverlay projectId={project.id} projectName={project.title} token={params.token} />
                          <div className="absolute top-2 left-2 text-[10px] font-mono bg-background/90 px-1.5 py-0.5 rounded z-10">
                            #{String(i + 1).padStart(2, "0")}
                          </div>
                          {i > 0 && (
                            <div className="absolute top-2 right-2 z-10">
                              <CliVersionCompareModal 
                                currentUrl={p.imageData || ""} 
                                previousUrl={sb.panels[i-1].imageData || ""} 
                                isVideo={false} 
                              />
                            </div>
                          )}
                        </div>
                        {(p.caption || p.dialogue) && (
                          <div className="p-3 text-xs">
                            {p.caption && <div>{p.caption}</div>}
                            {p.dialogue && <div className="italic text-muted-foreground mt-1">"{p.dialogue}"</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="animatic">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {animatics.length === 0 && <Empty msg="No animatics shared." />}
              {animatics.map((a, idx) => {
                const yt = youTubeId(a.videoData);
                const vm = vimeoId(a.videoData);
                return (
                  <div key={a.id} className="rounded-xl border border-card-border bg-card overflow-hidden relative">
                    <div className="aspect-video bg-black relative">
                      {yt ? <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${yt}`} allowFullScreen /> :
                        vm ? <iframe className="w-full h-full" src={`https://player.vimeo.com/video/${vm}`} allowFullScreen /> :
                        <video controls src={a.videoData} className="w-full h-full" />}
                      <CliWatermarkOverlay projectId={project.id} projectName={project.title} token={params.token} />
                    </div>
                    <div className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="font-display font-semibold text-sm mb-1">{a.title}</div>
                        {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                      </div>
                      {idx > 0 && !yt && !vm && (
                        <CliVersionCompareModal 
                          currentUrl={a.videoData} 
                          previousUrl={animatics[idx-1].videoData} 
                          isVideo={true} 
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="scenes">
            <div className="rounded-xl border border-card-border bg-card overflow-hidden">
              {scenes.length === 0 ? <Empty msg="No scenes shared." /> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-medium">#</th>
                      <th className="text-left px-4 py-2.5 font-medium">Title</th>
                      <th className="text-left px-4 py-2.5 font-medium">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenes.map((s) => {
                      const d = formatDeadline(s.deadline);
                      return (
                        <tr key={s.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5 font-mono text-xs">{s.number}</td>
                          <td className="px-4 py-2.5">{s.title}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${statusClass(s.status)}`}>
                              {STATUS_LABELS[s.status]}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{d.text}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border py-5 mt-8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-primary"><CelLogo size={14} /></span>
            <span>Powered by <span className="font-medium text-foreground">Cel</span></span>
          </div>
          <a href="#/signup" className="hover:text-foreground">Create your own project →</a>
        </div>
      </footer>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-sm text-muted-foreground text-center py-10">{msg}</div>;
}
