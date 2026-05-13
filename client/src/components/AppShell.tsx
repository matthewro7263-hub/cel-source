import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { CelLogo } from "./CelLogo";
import {
  LayoutDashboard, Settings, LogOut, Sun, Moon, Menu, X, DollarSign,
  Trophy, Inbox, Search, Accessibility, Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils-cel";
import type { Project } from "@shared/schema";

export function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const projectId = location.match(/^\/projects\/(\d+)/)?.[1];

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      {/* Atmosphere blobs — fixed, behind everything */}
      <div className="blob blob-lavender" style={{ zIndex: 0 }} />
      <div className="blob blob-peach" style={{ zIndex: 0 }} />
      <div className="blob blob-sky" style={{ zIndex: 0 }} />

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 glass flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-primary">
          <CelLogo size={22} />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">Cel</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={`${
          mobileOpen ? "block" : "hidden"
        } lg:block fixed lg:relative inset-0 z-30 w-full lg:w-[240px] flex-shrink-0 glass border-r border-sidebar-border pt-14 lg:pt-0`}
        data-testid="sidebar-main"
        style={{ borderRadius: 0 }}
      >
        <div className="flex h-full flex-col">
          <div className="hidden lg:flex items-center gap-2.5 px-5 h-14 border-b border-sidebar-border/60">
            <span className="text-primary"><CelLogo size={22} /></span>
            <span className="font-display text-lg font-bold tracking-tight">Cel</span>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            <Link href="/dashboard">
              <div
                className={`sidebar-nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150 hover:bg-white/40 dark:hover:bg-white/5 ${
                  location === "/dashboard" || location === "/"
                    ? "bg-white/50 dark:bg-white/8 shadow-sm font-medium active"
                    : ""
                }`}
                onClick={() => setMobileOpen(false)}
                data-testid="link-dashboard"
              >
                <LayoutDashboard size={15} className="text-muted-foreground" />
                Dashboard
              </div>
            </Link>

            {user && (
              <Link href="/commissions">
                <div
                className={`sidebar-nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150 hover:bg-white/40 dark:hover:bg-white/5 ${
                  location === "/commissions"
                    ? "bg-white/50 dark:bg-white/8 shadow-sm font-medium active"
                    : ""
                }`}
                onClick={() => setMobileOpen(false)}
                  data-testid="link-commissions"
                >
                  <DollarSign size={15} className="text-muted-foreground" />
                  Commissions
                </div>
              </Link>
            )}

            {/* === AGENT_BIZ ADDITIONS START === */}
            {user && (
              <Link href="/business">
                <div
                  className={`sidebar-nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150 hover:bg-white/40 dark:hover:bg-white/5 ${
                    location === "/business"
                      ? "bg-white/50 dark:bg-white/8 shadow-sm font-medium active"
                      : ""
                  }`}
                  onClick={() => setMobileOpen(false)}
                  data-testid="link-business"
                >
                  <Briefcase size={15} className="text-muted-foreground" />
                  Business
                </div>
              </Link>
            )}
            {/* === AGENT_BIZ ADDITIONS END === */}

            <div className="pt-5 pb-2 px-3 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              Community
            </div>
            
            <Link href="/challenges">
              <div
                className={`sidebar-nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150 hover:bg-white/40 dark:hover:bg-white/5 ${
                  location === "/challenges"
                    ? "bg-white/50 dark:bg-white/8 shadow-sm font-medium active"
                    : ""
                }`}
                onClick={() => setMobileOpen(false)}
                data-testid="link-challenges"
              >
                <Trophy size={15} className="text-muted-foreground" />
                Challenges
              </div>
            </Link>

            <div className="pt-5 pb-2 px-3 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              Projects
            </div>

            {projects && projects.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No projects yet.</div>
            )}

            {projects?.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <div
                  className={`sidebar-nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150 hover:bg-white/40 dark:hover:bg-white/5 ${
                    projectId === String(p.id)
                      ? "bg-white/50 dark:bg-white/8 shadow-sm font-medium active"
                      : ""
                  }`}
                  onClick={() => setMobileOpen(false)}
                  data-testid={`link-project-${p.id}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white/60"
                    style={{ backgroundColor: p.coverColor }}
                  />
                  <span className="truncate">{p.title}</span>
                </div>
              </Link>
            ))}
          </nav>

          {/* User menu at bottom — glass pill */}
          {user && (
            <div className="px-3 py-3 border-t border-sidebar-border/60">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl glass-pill transition-all duration-150 hover:shadow-md text-left"
                    data-testid="button-user-menu"
                  >
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarFallback
                        style={{ backgroundColor: user.avatarColor, color: "white" }}
                        className="text-xs font-semibold"
                      >
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{user.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => setLocation("/settings")} data-testid="menuitem-settings">
                    <Settings className="mr-2 h-4 w-4" /> Profile settings
                  </DropdownMenuItem>
                  {/* === AGENT_5 ADDITIONS START === */}
                  <DropdownMenuItem onSelect={() => setLocation("/analytics")} data-testid="menuitem-analytics">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Analytics
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLocation("/scratchpad")} data-testid="menuitem-scratchpad">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Scratchpad
                  </DropdownMenuItem>
                  {/* === AGENT_5 ADDITIONS END === */}
                  {/* v4 nav items */}
                  <DropdownMenuItem onSelect={() => setLocation("/achievements")} data-testid="menuitem-achievements">
                    <Trophy className="mr-2 h-4 w-4" /> Achievements
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLocation("/inbox")} data-testid="menuitem-inbox">
                    <Inbox className="mr-2 h-4 w-4" /> Inbox
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLocation("/settings/a11y")} data-testid="menuitem-a11y">
                    <Accessibility className="mr-2 h-4 w-4" /> Accessibility
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={toggle} data-testid="menuitem-toggle-theme">
                    {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout} data-testid="menuitem-logout">
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pt-14 lg:pt-0 relative z-10">{children}</main>
    </div>
  );
}
