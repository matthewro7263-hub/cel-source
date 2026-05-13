import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import {
  PlayCircle,
  Brush,
  Film,
  Briefcase,
  Code2,
  ArrowRight,
  Boxes,
  Sparkles,
  Layers,
  PenTool,
  Wand2,
} from "lucide-react";

/**
 * Public marketing landing page for Cel.
 *
 * Copy is intentionally honest to the product — Cel is a creator-first
 * animation studio for solo artists, fan-animators, and commission creators,
 * not a vendor for big-studio TDs/producers. So the four bento cards target
 * Artists, Animators, Commission Creators, and Pipeline Tinkerers.
 */
export default function Landing() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useHashLocation();

  // If the user is already logged in, skip the marketing page and send them
  // straight to the dashboard.
  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation]);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-on-surface antialiased landing-root">
      {/* Fluid mesh background */}
      <div className="fixed inset-0 z-0 landing-bg landing-dot-grid pointer-events-none" />

      {/* Top nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-[20px] bg-white/40 dark:bg-black/30 border-b border-white/40 dark:border-white/10 shadow-sm">
        <div className="flex justify-between items-center px-6 py-4 max-w-[1440px] mx-auto">
          <Link href="/" className="flex items-center gap-2 group">
            <PlayCircle className="w-6 h-6 text-sky-600" fill="currentColor" fillOpacity={0.15} />
            <span className="font-extrabold tracking-tight text-2xl">Cel</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm">
            <a href="#artists" className="hover:text-sky-600 transition-colors">Artists</a>
            <a href="#animators" className="hover:text-sky-600 transition-colors">Animators</a>
            <a href="#commissions" className="hover:text-sky-600 transition-colors">Commissions</a>
            <a href="#tinkerers" className="hover:text-sky-600 transition-colors">Pipeline</a>
          </div>

          <Link
            href="/signup"
            className="btn-sky-halo text-sm font-semibold px-5 py-2.5 rounded-full"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <main className="relative z-10 pt-[110px] pb-24 px-6 max-w-[1440px] mx-auto flex flex-col items-center">
        {/* Hero */}
        <section className="w-full text-center mt-10 mb-24 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider mb-6 landing-chip">
            <Sparkles className="w-3.5 h-3.5" />
            Built for solo creators
          </div>
          <h1 className="font-extrabold leading-[1.04] tracking-tight text-5xl sm:text-6xl md:text-7xl mb-6 max-w-4xl uppercase">
            Make your animation.
            <br />
            <span className="text-sky-600">Not your spreadsheet.</span>
          </h1>
          <p className="text-lg sm:text-xl text-on-surface/70 max-w-2xl mb-10 leading-relaxed">
            Cel is the creator studio for indie animators, fan-artists, and commission creators.
            Storyboards, animatics, video edits, palette tools, and a commissions queue —
            all in one quiet place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-14">
            <Link
              href="/signup"
              className="btn-sky-halo text-base font-bold px-8 py-4 rounded-full w-full sm:w-auto text-center"
            >
              Start Creating — Free
            </Link>
            <Link
              href="/login"
              className="landing-glass-btn text-base font-bold px-8 py-4 rounded-full w-full sm:w-auto text-center"
            >
              Sign In
            </Link>
          </div>

          {/* Stacked UI preview */}
          <div className="relative w-full max-w-5xl mx-auto group" style={{ perspective: "1200px" }}>
            <div className="landing-panel rounded-2xl p-2 absolute inset-0 opacity-70 transition-all duration-500 group-hover:opacity-90"
                 style={{ transform: "rotateY(-3deg) rotateX(4deg) translate(-4%,-6%) scale(0.95)" }}>
              <div className="aspect-video w-full rounded-xl landing-preview-back" />
            </div>
            <div className="landing-panel rounded-2xl p-2 relative z-10 shadow-2xl transition-all duration-500 group-hover:translate-y-0"
                 style={{ transform: "rotateY(2deg) translate(3%,3%)" }}>
              <div className="aspect-video w-full rounded-xl landing-preview-front overflow-hidden">
                <div className="w-full h-full grid grid-cols-12 grid-rows-6 gap-2 p-3">
                  <div className="col-span-3 row-span-6 rounded-lg landing-mini-sidebar" />
                  <div className="col-span-9 row-span-1 rounded-lg landing-mini-row" />
                  <div className="col-span-3 row-span-3 rounded-lg landing-mini-card" />
                  <div className="col-span-3 row-span-3 rounded-lg landing-mini-card-2" />
                  <div className="col-span-3 row-span-3 rounded-lg landing-mini-card-3" />
                  <div className="col-span-9 row-span-2 rounded-lg landing-mini-timeline" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Plays nice with */}
        <section className="w-full text-center mb-24 flex flex-col items-center">
          <h2 className="font-extrabold tracking-tight text-3xl sm:text-4xl mb-2">Plays nice with your tools</h2>
          <p className="text-on-surface/60 mb-10 max-w-xl">Export and import everywhere you already work.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: "Blender", icon: Boxes },
              { label: "Moho", icon: Film },
              { label: "Procreate", icon: PenTool },
              { label: "After Effects", icon: Wand2 },
              { label: "Ko-fi", icon: Sparkles },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="landing-pill flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
            ))}
          </div>
        </section>

        {/* Bento feature cards */}
        <section className="w-full max-w-5xl mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureCard
              id="artists"
              icon={<Brush className="w-7 h-7 text-sky-600" />}
              title="For Artists"
              body="Focus on the canvas. Storyboards, palette tools, scratchpads, and reference boards — your versions and notes managed quietly in the background."
              cta="Explore artist tools"
              blob="blob-sky"
            />
            <FeatureCard
              id="animators"
              icon={<Film className="w-7 h-7 text-sky-600" />}
              title="For Animators"
              body="Build animatics and storyboard cuts with a real timeline. Drag panels in, scrub, set durations, and export a WebM ready for review or upload."
              cta="See the video editor"
              blob="blob-lavender"
            />
            <FeatureCard
              id="commissions"
              icon={<Briefcase className="w-7 h-7 text-sky-600" />}
              title="For Commission Creators"
              body="A real commissions queue: intake forms, statuses, deadlines, and Ko-fi integration. Track your business without spreadsheets or sticky notes."
              cta="Open the queue"
              blob="blob-peach"
            />
            <FeatureCard
              id="tinkerers"
              icon={<Code2 className="w-7 h-7 text-sky-600" />}
              title="For Pipeline Tinkerers"
              body="Cel ships with a clean REST API, Blender-friendly exports, and JSON-everywhere data. Wire it into your own scripts, MCP servers, or Discord bots."
              cta="Peek under the hood"
              blob="blob-sky"
            />
          </div>
        </section>

        {/* What's inside */}
        <section className="w-full max-w-5xl mb-24">
          <div className="text-center mb-12">
            <h2 className="font-extrabold tracking-tight text-3xl sm:text-4xl mb-2">Everything in one quiet place</h2>
            <p className="text-on-surface/60 max-w-xl mx-auto">No tab juggling. No naming conventions. No spreadsheet.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              ["Storyboards", Layers],
              ["Animatic editor", Film],
              ["Video editor", PlayCircle],
              ["Palette matcher", Brush],
              ["Commissions queue", Briefcase],
              ["Voice booth + audio", Wand2],
              ["Scratchpad", PenTool],
              ["Sprite sheets", Boxes],
              ["Couch mode review", Sparkles],
            ].map(([label, Icon]) => (
              <div key={label as string} className="landing-mini-feature flex items-center gap-3 px-4 py-3 rounded-2xl">
                {/* @ts-ignore */}
                <Icon className="w-5 h-5 text-sky-600 shrink-0" />
                <span className="font-medium text-sm">{label as string}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Conversion */}
        <section className="w-full max-w-4xl mx-auto landing-panel rounded-3xl p-10 sm:p-14 text-center flex flex-col items-center shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-sky-100/20 pointer-events-none" />
          <h2 className="font-extrabold tracking-tight text-4xl sm:text-5xl mb-3 relative z-10">Ready to animate?</h2>
          <p className="text-lg text-on-surface/70 mb-8 relative z-10 max-w-lg">
            Make your account, start your first storyboard in under a minute. Free while in beta.
          </p>
          <Link
            href="/signup"
            className="btn-sky-halo text-base font-bold px-8 py-4 rounded-full relative z-10"
          >
            Get Started
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-12 backdrop-blur-[30px] bg-white/30 dark:bg-black/20 border-t border-white/30">
        <div className="flex flex-col md:flex-row justify-between items-start px-6 max-w-[1440px] mx-auto gap-10 md:gap-0">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-sky-600" fill="currentColor" fillOpacity={0.15} />
              <span className="font-extrabold text-xl">Cel</span>
            </div>
            <p className="text-sm text-on-surface/60 max-w-xs">
              © 2026 Cel. A creator-first animation studio. Built with care for indie animators.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-10 md:gap-16">
            <FooterCol title="Product" links={[
              { label: "Sign in", href: "/login" },
              { label: "Sign up", href: "/signup" },
            ]} />
            <FooterCol title="Made by" links={[
              { label: "Matthew Reyes", href: "#" },
            ]} />
            <FooterCol title="Legal" links={[
              { label: "Privacy", href: "#" },
              { label: "Terms", href: "#" },
            ]} />
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  id,
  icon,
  title,
  body,
  cta,
  blob,
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  blob: "blob-sky" | "blob-lavender" | "blob-peach";
}) {
  return (
    <div id={id} className="landing-panel rounded-3xl p-7 flex flex-col relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className={`absolute -right-12 -top-12 w-40 h-40 rounded-full blur-3xl opacity-50 landing-${blob}`} />
      <div className="mb-4 relative z-10">{icon}</div>
      <h3 className="font-extrabold text-2xl mb-2 relative z-10">{title}</h3>
      <p className="text-on-surface/70 mb-6 flex-grow relative z-10 leading-relaxed">{body}</p>
      <Link
        href="/signup"
        className="text-xs font-mono uppercase tracking-wider text-sky-700 dark:text-sky-300 flex items-center gap-1.5 group-hover:underline relative z-10"
      >
        {cta} <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-mono uppercase tracking-wider font-bold">{title}</h4>
      {links.map((l) => (
        l.href.startsWith("/") ? (
          <Link key={l.label} href={l.href} className="text-sm text-on-surface/70 hover:text-sky-600 transition-colors">
            {l.label}
          </Link>
        ) : (
          <a key={l.label} href={l.href} className="text-sm text-on-surface/70 hover:text-sky-600 transition-colors">
            {l.label}
          </a>
        )
      ))}
    </div>
  );
}
