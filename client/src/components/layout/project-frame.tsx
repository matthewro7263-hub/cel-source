import type { ReactNode } from "react";
import { Link } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GlassButton } from "@/components/ui/glass-button";
import { Calendar, Columns2, Film, MessageSquare, Mic, Presentation, Radio, Scroll, Settings, SunMedium } from "lucide-react";
import { formatDeadline, initials } from "@/lib/utils-cel";
import type { Project } from "@shared/schema";

export type ProjectSection =
  | "overview"
  | "script"
  | "storyboards"
  | "assets"
  | "animatics"
  | "scenes"
  | "comments"
  | "continuity"
  | "casting"
  | "signoff"
  | "settings";

type MemberSummary = {
  id: number;
  role: string;
  user: { id: number; name: string; email: string; avatarColor: string } | null;
};

interface ProjectFrameProps {
  project: Project;
  members: MemberSummary[];
  activeSection: ProjectSection;
  children: ReactNode;
}

const GROUPS: Array<{
  id: "overview" | "production" | "review" | "settings";
  label: string;
  href: (projectId: number) => string;
  sections: Array<{ id: ProjectSection; label: string; href: (projectId: number) => string }>;
}> = [
  {
    id: "overview",
    label: "Overview",
    href: (projectId) => `/projects/${projectId}`,
    sections: [{ id: "overview", label: "Project summary", href: (projectId) => `/projects/${projectId}` }],
  },
  {
    id: "production",
    label: "Production",
    href: (projectId) => `/projects/${projectId}/script`,
    sections: [
      { id: "script", label: "Script", href: (projectId) => `/projects/${projectId}/script` },
      { id: "storyboards", label: "Storyboards", href: (projectId) => `/projects/${projectId}/storyboards` },
      { id: "assets", label: "Assets", href: (projectId) => `/projects/${projectId}/assets` },
      { id: "animatics", label: "Animatics", href: (projectId) => `/projects/${projectId}/animatics` },
      { id: "scenes", label: "Scenes", href: (projectId) => `/projects/${projectId}/scenes` },
    ],
  },
  {
    id: "review",
    label: "Review",
    href: (projectId) => `/projects/${projectId}/comments`,
    sections: [
      { id: "comments", label: "Comments", href: (projectId) => `/projects/${projectId}/comments` },
      { id: "continuity", label: "Continuity", href: (projectId) => `/projects/${projectId}/continuity` },
      { id: "casting", label: "Casting", href: (projectId) => `/projects/${projectId}/casting` },
      { id: "signoff", label: "Sign-off", href: (projectId) => `/projects/${projectId}/signoff` },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    href: (projectId) => `/projects/${projectId}/settings`,
    sections: [{ id: "settings", label: "Project settings", href: (projectId) => `/projects/${projectId}/settings` }],
  },
];

function getActiveGroup(section: ProjectSection) {
  return GROUPS.find((group) => group.sections.some((item) => item.id === section)) ?? GROUPS[0];
}

export function ProjectFrame({ project, members, activeSection, children }: ProjectFrameProps) {
  const activeGroup = getActiveGroup(activeSection);
  const deadline = formatDeadline(project.deadline);

  return (
    <div className="px-5 sm:px-6 lg:px-10 py-7 lg:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.coverColor }} />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Project</span>
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight" data-testid="text-project-title">
              {project.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              {project.description || "No description yet."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={12} />
                {deadline.text}
              </span>
              <span>{members.length} collaborator{members.length === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-border/70 bg-background/82 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur-[12px] xl:w-[360px]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Project tools</div>
              <div className="flex -space-x-1.5">
                {members.slice(0, 4).map((member) =>
                  member.user ? (
                    <Avatar key={member.id} className="h-7 w-7 ring-2 ring-background">
                      <AvatarFallback style={{ backgroundColor: member.user.avatarColor, color: "white" }} className="text-[10px] font-semibold">
                        {initials(member.user.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : null,
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ProjectToolButton href={`/projects/${project.id}/video-editor`} icon={<Film size={14} />} label="Video Editor" />
              <ProjectToolButton href={`/projects/${project.id}/compare`} icon={<Columns2 size={14} />} label="Compare" />
              <ProjectToolButton href={`/projects/${project.id}/review-room`} icon={<Radio size={14} />} label="Review Room" />
              <ProjectToolButton href={`/projects/${project.id}/light-lab`} icon={<SunMedium size={14} />} label="Light Lab" />
              <ProjectToolButton href={`/projects/${project.id}/voicebooth`} icon={<Mic size={14} />} label="Voice Booth" />
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-border/70 bg-background/84 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur-[12px]">
          <div className="flex flex-wrap gap-2">
            {GROUPS.map((group) => {
              const active = group.id === activeGroup.id;
              return (
                <Button key={group.id} asChild variant={active ? "default" : "outline"} size="sm" className="h-9">
                  <Link href={group.href(project.id)}>
                    {group.label}
                  </Link>
                </Button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeGroup.sections.map((section) => {
              const active = section.id === activeSection;
              return (
                <Button key={section.id} asChild variant={active ? "secondary" : "ghost"} size="sm" className="h-8 text-xs">
                  <Link href={section.href(project.id)}>
                    {section.label}
                  </Link>
                </Button>
              );
            })}
          </div>
        </section>

        {children}
      </div>
    </div>
  );
}

function ProjectToolButton({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <GlassButton
      type="button"
      variant="ghost"
      size="sm"
      className="h-9 border border-border/60 bg-background/72 text-foreground hover:bg-background/92"
      onClick={() => {
        window.location.hash = href;
      }}
    >
      {icon}
      {label}
    </GlassButton>
  );
}

export function ProjectQuickActions({ projectId }: { projectId: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/84 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur-[12px]">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare size={15} className="text-primary" />
        <h2 className="font-display text-base font-semibold">Quick actions</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <ProjectToolButton href={`/projects/${projectId}/audio2`} icon={<Mic size={14} />} label="Audio Tools" />
        <ProjectToolButton href={`/projects/${projectId}/couch`} icon={<Presentation size={14} />} label="Couch Mode" />
        <ProjectToolButton href={`/projects/${projectId}/credits`} icon={<Scroll size={14} />} label="Credits" />
        <ProjectToolButton href={`/projects/${projectId}/settings`} icon={<Settings size={14} />} label="Settings" />
      </div>
    </div>
  );
}
