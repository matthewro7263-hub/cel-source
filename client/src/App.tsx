import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { useLiquidGL } from "@/hooks/useLiquidGL";
import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { AppShell } from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Landing from "@/pages/Landing";
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ProjectWorkspace = lazy(() => import("@/pages/ProjectWorkspace"));
const ProjectSectionPage = lazy(() =>
  import("@/pages/ProjectWorkspace").then((m) => ({ default: m.ProjectSectionPage })),
);
import Share from "@/pages/Share";
import ProfileSettings from "@/pages/ProfileSettings";
import CommissionIntake from "@/pages/CommissionIntake";
import CommissionsQueue from "@/pages/CommissionsQueue";
import PaletteMatcher from "./pages/lor/PaletteMatcher";
import EpisodeBible from "./pages/lor/EpisodeBible";
import NotFound from "@/pages/not-found";
const AnimaticEditor = lazy(() => import("@/pages/animatic-editor"));
const VideoEditor = lazy(() => import("@/pages/video-editor"));
import ComparePage from "@/pages/compare";
const ReviewRoomPage = lazy(() => import("@/pages/review-room"));
import InbetweenColorLab from "@/pages/inbetween-color";
// v4 imports
import Achievements from "@/pages/Achievements";
import InboxPage from "@/pages/Inbox";
import { CmdkPalette } from "@/components/cmdk-palette";
import { QuickCaptureFAB } from "@/components/quick-capture-fab";
import { ShortcutsCheatsheet } from "@/components/shortcuts-cheatsheet";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";

import { A11yProvider } from "@/lib/a11y-preferences";

import BakTrashPage from "@/pages/bak/Trash";
import BakSpriteSheetPage from "@/pages/bak/SpriteSheet";
import A11ySettings from "@/pages/a11y";
import ChallengeFeed from "@/pages/challenge";


import AudVoiceBoothPage from "@/pages/aud_voicebooth";
import Audio2Page from "@/pages/audio2";

const AnalyticsPage = lazy(() => import("@/pages/analytics"));
import ScratchpadPage from "@/pages/scratchpad";
import CouchModePage from "@/pages/couch-mode";

import RenderBudget from "@/pages/studio/RenderBudget";
import Snapshots from "@/pages/studio/Snapshots";
import CreditRoll from "@/pages/studio/CreditRoll";
import LightLab from "@/pages/studio/LightLab";
import LiquidGlassDemo from "@/pages/LiquidGlassDemo";

const BizPage = lazy(() => import("@/pages/biz/index"));

function RouteSpinner() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteSpinner />}>{children}</Suspense>;
}

function Protected({ children, fullscreen = false }: { children: React.ReactNode; fullscreen?: boolean }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  return fullscreen ? <>{children}</> : <AppShell>{children}</AppShell>;
}

function MarketingSection({ sectionId }: { sectionId: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [sectionId]);
  return <Landing />;
}

function ProtectedShell({ children }: { children: React.ReactNode }) {
  return <Protected>{children}</Protected>;
}

function ProtectedFullscreen({ children }: { children: React.ReactNode }) {
  return <Protected fullscreen>{children}</Protected>;
}

function ReviewRoomRoute() {
  return <ProtectedShell><LazyRoute><ReviewRoomPage /></LazyRoute></ProtectedShell>;
}

function ProjectSectionRoute({ section }: { section: "script" | "storyboards" | "assets" | "animatics" | "scenes" | "comments" | "continuity" | "casting" | "signoff" | "settings" }) {
  return <ProtectedShell><LazyRoute><ProjectSectionPage section={section} /></LazyRoute></ProtectedShell>;
}

// Landing page handles its own auth-redirect (logged-in users go to dashboard)
// so unauthenticated visitors see the marketing page at "/".


function AppRouter() {
  useLiquidGL(); // re-init liquidGL on every route change
  const [, setLocation] = useHashLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  // Signal to open new project dialog — propagated via event
  const handleNewProject = useCallback(() => {
    window.dispatchEvent(new CustomEvent("cel:new-project"));
  }, []);

  useEffect(() => {
    const onOpenSearch = () => setSearchOpen(true);
    window.addEventListener("cel:open-search", onOpenSearch);
    return () => window.removeEventListener("cel:open-search", onOpenSearch);
  }, []);

  useGlobalShortcuts({
    onOpenSearch: () => setSearchOpen(true),
    onOpenNewProject: handleNewProject,
    onNavigate: setLocation,
    onOpenCheatsheet: () => setCheatsheetOpen(true),
  });

  return (
    <>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/liquid-glass-demo" component={LiquidGlassDemo} />
        <Route path="/artists">{() => <MarketingSection sectionId="artists" />}</Route>
        <Route path="/animators">{() => <MarketingSection sectionId="animators" />}</Route>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/share/:token" component={Share} />
        <Route path="/dashboard">
          <ProtectedShell><LazyRoute><Dashboard /></LazyRoute></ProtectedShell>
        </Route>
        <Route path="/projects/:id/script">
          <ProjectSectionRoute section="script" />
        </Route>
        <Route path="/projects/:id/storyboards">
          <ProjectSectionRoute section="storyboards" />
        </Route>
        <Route path="/projects/:id/assets">
          <ProjectSectionRoute section="assets" />
        </Route>
        <Route path="/projects/:id/animatics">
          <ProjectSectionRoute section="animatics" />
        </Route>
        <Route path="/projects/:id/scenes">
          <ProjectSectionRoute section="scenes" />
        </Route>
        <Route path="/projects/:id/comments">
          <ProjectSectionRoute section="comments" />
        </Route>
        <Route path="/projects/:id/continuity">
          <ProjectSectionRoute section="continuity" />
        </Route>
        <Route path="/projects/:id/casting">
          <ProjectSectionRoute section="casting" />
        </Route>
        <Route path="/projects/:id/signoff">
          <ProjectSectionRoute section="signoff" />
        </Route>
        <Route path="/projects/:id/settings">
          <ProjectSectionRoute section="settings" />
        </Route>
        <Route path="/projects/:id">
          <ProtectedShell><LazyRoute><ProjectWorkspace /></LazyRoute></ProtectedShell>
        </Route>
        <Route path="/settings">
          <ProtectedShell><ProfileSettings /></ProtectedShell>
        </Route>
        <Route path="/settings/a11y">
          <ProtectedShell><A11ySettings /></ProtectedShell>
        </Route>
        <Route path="/challenges">
          <ProtectedShell><ChallengeFeed /></ProtectedShell>
        </Route>
        <Route path="/commissions">
          <ProtectedShell><CommissionsQueue /></ProtectedShell>
        </Route>
                <Route path="/commission/:userId" component={CommissionIntake} />
        <Route path="/projects/:id/palette">
          <ProtectedShell><PaletteMatcher /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/bible">
          <ProtectedShell><EpisodeBible /></ProtectedShell>
        </Route>
        {/* v4 routes — achievements and inbox */}
        <Route path="/achievements">
          <ProtectedShell><Achievements /></ProtectedShell>
        </Route>
        <Route path="/inbox">
          <ProtectedShell><InboxPage /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/render-budget">
          <ProtectedShell><RenderBudget /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/snapshots">
          <ProtectedShell><Snapshots /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/credits">
          <ProtectedShell><CreditRoll /></ProtectedShell>
        </Route>
        <Route path="/analytics">
          <ProtectedShell><LazyRoute><AnalyticsPage /></LazyRoute></ProtectedShell>
        </Route>
        <Route path="/scratchpad">
          <ProtectedFullscreen><ScratchpadPage /></ProtectedFullscreen>
        </Route>
        <Route path="/projects/:id/couch">
          <ProtectedFullscreen><CouchModePage /></ProtectedFullscreen>
        </Route>

        <Route path="/business">
          <ProtectedShell><LazyRoute><BizPage /></LazyRoute></ProtectedShell>
        </Route>

        <Route path="/projects/:id/trash">
          <ProtectedShell><BakTrashPage /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/spritesheet">
          <ProtectedShell><BakSpriteSheetPage /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/voicebooth">
          <ProtectedShell><AudVoiceBoothPage /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/audio2">
          {(params) => <ProtectedShell><Audio2Page params={{id: params.id}} /></ProtectedShell>}
        </Route>
        {/* animatic editor */}
        <Route path="/projects/:projectId/animatic/:animaticId">
          <ProtectedFullscreen><LazyRoute><AnimaticEditor /></LazyRoute></ProtectedFullscreen>
        </Route>
        {/* video editor — timeline for storyboards + animatics */}
        <Route path="/projects/:id/video">
          {(params) => <Redirect to={`/projects/${params.id}/video-editor`} />}
        </Route>
        <Route path="/projects/:id/video-editor">
          {() => <ProtectedShell><LazyRoute><VideoEditor /></LazyRoute></ProtectedShell>}
        </Route>
        <Route path="/projects/:id/compare">
          <ProtectedShell><ComparePage /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/review-room">
          <ReviewRoomRoute />
        </Route>
        <Route path="/projects/:id/review">
          <ReviewRoomRoute />
        </Route>
        <Route path="/projects/:id/inbetween">
          <ProtectedShell><InbetweenColorLab /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/light-lab">
          <ProtectedShell><LightLab /></ProtectedShell>
        </Route>
        <Route component={NotFound} />
      </Switch>
      {/* v4 global overlays */}
      <CmdkPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <ShortcutsCheatsheet open={cheatsheetOpen} onOpenChange={setCheatsheetOpen} />
      <V4FAB />
    </>
  );
}

// Only show FAB when authenticated
function V4FAB() {
  const { user } = useAuth();
  const [location] = useHashLocation();
  if (!user) return null;
  if (location === "/scratchpad" || /\/projects\/[^/]+\/couch$/.test(location)) return null;
  return <QuickCaptureFAB />;
}

function App() {
  return (
    <ErrorBoundary scope="root">
      <QueryClientProvider client={queryClient}>
        <A11yProvider>
          <ThemeProvider>
            <AuthProvider>
              <TooltipProvider>
                <Toaster />
                <Router hook={useHashLocation}>
                  <ErrorBoundary scope="router">
                    <AppRouter />
                  </ErrorBoundary>
                </Router>
              </TooltipProvider>
            </AuthProvider>
          </ThemeProvider>
        </A11yProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
