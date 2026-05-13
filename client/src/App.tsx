import { useEffect, useState, useCallback } from "react";
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
import Dashboard from "@/pages/Dashboard";
import ProjectWorkspace from "@/pages/ProjectWorkspace";
import Share from "@/pages/Share";
import ProfileSettings from "@/pages/ProfileSettings";
import CommissionIntake from "@/pages/CommissionIntake";
import CommissionsQueue from "@/pages/CommissionsQueue";
// === AGENT_3 ADDITIONS START ===
import PaletteMatcher from "./pages/lor/PaletteMatcher";
import EpisodeBible from "./pages/lor/EpisodeBible";
// === AGENT_3 ADDITIONS END ===
import NotFound from "@/pages/not-found";
import AnimaticEditor from "@/pages/animatic-editor";
import VideoEditor from "@/pages/video-editor";
import ComparePage from "@/pages/compare";
import ReviewRoomPage from "@/pages/review-room";
import InbetweenColorLab from "@/pages/inbetween-color";
// v4 imports
import Achievements from "@/pages/Achievements";
import InboxPage from "@/pages/Inbox";
import { CmdkPalette } from "@/components/cmdk-palette";
import { QuickCaptureFAB } from "@/components/quick-capture-fab";
import { ShortcutsCheatsheet } from "@/components/shortcuts-cheatsheet";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";

import { A11yProvider } from "@/lib/a11y-preferences";

// === AGENT_4 ADDITIONS START ===
import BakTrashPage from "@/pages/bak/Trash";
import BakSpriteSheetPage from "@/pages/bak/SpriteSheet";
import A11ySettings from "@/pages/a11y";
import ChallengeFeed from "@/pages/challenge";

// === AGENT_4 ADDITIONS END ===

// === AGENT_2 ADDITIONS START ===
import AudVoiceBoothPage from "@/pages/aud_voicebooth";
import Audio2Page from "@/pages/audio2";
// === AGENT_2 ADDITIONS END ===

// === AGENT_5 ADDITIONS START ===
import AnalyticsPage from "@/pages/analytics";
import ScratchpadPage from "@/pages/scratchpad";
import CouchModePage from "@/pages/couch-mode";
// === AGENT_5 ADDITIONS END ===

// === AGENT_STUDIO ADDITIONS START ===
import RenderBudget from "@/pages/studio/RenderBudget";
import Snapshots from "@/pages/studio/Snapshots";
import CreditRoll from "@/pages/studio/CreditRoll";
// === AGENT_STUDIO ADDITIONS END ===

// === AGENT_BIZ ADDITIONS START ===
import BizPage from "@/pages/biz/index";
// === AGENT_BIZ ADDITIONS END ===

// ── liquidGL initializer ─────────────────────────────────────────────────────
// liquidGL is a window-global loaded via <script> in index.html.
// We call it after React mounts, and again on route changes, so new .liquidGL
// elements picked up after navigation also get the WebGL treatment.
// Defensive: wrapped in try/catch — CSS fallback (backdrop-filter) is already
// beautiful if WebGL is unavailable (e.g. Firefox without hardware acceleration,
// some sandboxed iframes, or old Safari).
declare global {
  interface Window {
    liquidGL?: (opts: Record<string, unknown>) => { refresh?: () => void } | void;
  }
}

// liquidGL is DISABLED.
//
// The library snapshots the page and renders a WebGL refraction canvas over
// each target element. In practice it occluded sidebar nav items and hero
// content (children of .liquidGL-bg elements get hidden behind the WebGL
// canvas), so the user reported "UI looks missing" on both the project page
// (sidebar gone) and the landing page (hero gone).
//
// The CSS-based .glass / .landing-panel frosted backdrop already delivers a
// polished glassmorphism look that works everywhere (no WebGL required, no
// crash surface, no Firefox/sandbox issues). The liquidGL.js + html2canvas.min.js
// scripts are still loaded for now — they do nothing without targets — and
// can be removed from index.html in a follow-up cleanup.

function useLiquidGL() {
  // no-op — retained as a named hook so AppRouter doesn't change shape, but
  // the WebGL effect is no longer initialized.
}
// ────────────────────────────────────────────────────────────────────────────

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  return <AppShell>{children}</AppShell>;
}

function ProtectedFullscreen({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

function ReviewRoomRoute() {
  return <ProtectedShell><ReviewRoomPage /></ProtectedShell>;
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
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/share/:token" component={Share} />
        <Route path="/dashboard">
          <ProtectedShell><Dashboard /></ProtectedShell>
        </Route>
        <Route path="/projects/:id">
          <ProtectedShell><ProjectWorkspace /></ProtectedShell>
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
        {/* === AGENT_3 ADDITIONS START === */}
        <Route path="/projects/:id/palette">
          <ProtectedShell><PaletteMatcher /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/bible">
          <ProtectedShell><EpisodeBible /></ProtectedShell>
        </Route>
        {/* === AGENT_3 ADDITIONS END === */}
        {/* v4 routes — achievements and inbox */}
        <Route path="/achievements">
          <ProtectedShell><Achievements /></ProtectedShell>
        </Route>
        <Route path="/inbox">
          <ProtectedShell><InboxPage /></ProtectedShell>
        </Route>
        {/* === AGENT_STUDIO ADDITIONS START === */}
        <Route path="/projects/:id/render-budget">
          <ProtectedShell><RenderBudget /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/snapshots">
          <ProtectedShell><Snapshots /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/credits">
          <ProtectedShell><CreditRoll /></ProtectedShell>
        </Route>
        {/* === AGENT_STUDIO ADDITIONS END === */}
        {/* === AGENT_5 ADDITIONS START === */}
        <Route path="/analytics">
          <ProtectedShell><AnalyticsPage /></ProtectedShell>
        </Route>
        <Route path="/scratchpad">
          <ProtectedFullscreen><ScratchpadPage /></ProtectedFullscreen>
        </Route>
        <Route path="/projects/:id/couch">
          <ProtectedFullscreen><CouchModePage /></ProtectedFullscreen>
        </Route>
        {/* === AGENT_5 ADDITIONS END === */}

        {/* === AGENT_BIZ ADDITIONS START === */}
        <Route path="/business">
          <ProtectedShell><BizPage /></ProtectedShell>
        </Route>
        {/* === AGENT_BIZ ADDITIONS END === */}

        {/* === AGENT_4 ADDITIONS START === */}
        <Route path="/projects/:id/trash">
          <ProtectedShell><BakTrashPage /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/spritesheet">
          <ProtectedShell><BakSpriteSheetPage /></ProtectedShell>
        </Route>
        {/* === AGENT_4 ADDITIONS END === */}
        {/* === AGENT_2 ADDITIONS START === */}
        <Route path="/projects/:id/voicebooth">
          <ProtectedShell><AudVoiceBoothPage /></ProtectedShell>
        </Route>
        <Route path="/projects/:id/audio2">
          {(params) => <ProtectedShell><Audio2Page params={{id: params.id}} /></ProtectedShell>}
        </Route>
        {/* === AGENT_2 ADDITIONS END === */}
        {/* animatic editor */}
        <Route path="/projects/:projectId/animatic/:animaticId">
          <AnimaticEditor />
        </Route>
        {/* video editor — timeline for storyboards + animatics */}
        <Route path="/projects/:id/video">
          {() => <ProtectedShell><VideoEditor /></ProtectedShell>}
        </Route>
        <Route path="/projects/:id/video-editor">
          {() => <ProtectedShell><VideoEditor /></ProtectedShell>}
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
