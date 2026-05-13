import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Panel } from "@shared/schema";

interface StoryboardReviewerProps {
  panels: Panel[];
  onClose: () => void;
}

export function StoryboardReviewer({ panels, onClose }: StoryboardReviewerProps) {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);

  const go = useCallback((next: number) => {
    if (fading) return;
    setFading(true);
    setTimeout(() => {
      setCurrent(next);
      setFading(false);
    }, 200);
  }, [fading]);

  const prev = useCallback(() => {
    if (current > 0) go(current - 1);
  }, [current, go]);

  const next = useCallback(() => {
    if (current < panels.length - 1) go(current + 1);
  }, [current, panels.length, go]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, onClose]);

  const panel = panels[current];
  if (!panel) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(135deg, rgba(14,12,28,0.97) 0%, rgba(24,18,46,0.97) 100%)",
        backdropFilter: "blur(20px)",
      }}
      data-testid="storyboard-reviewer"
    >
      {/* Gradient blobs in background for visual depth */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #6E4FE8 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #4FA8FF 0%, transparent 70%)" }} />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10">
        <span className="text-sm font-mono text-white/50 tracking-wider uppercase">
          Review Mode
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm font-mono text-white/60">
            {current + 1} / {panels.length}
          </span>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            data-testid="reviewer-exit"
            aria-label="Exit review"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main panel area */}
      <div className="relative flex items-center justify-center w-full px-20" style={{ height: "calc(100vh - 160px)" }}>
        {/* Prev button */}
        <button
          onClick={prev}
          disabled={current === 0}
          className="absolute left-5 h-12 w-12 rounded-full flex items-center justify-center text-white/70 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
          data-testid="reviewer-prev"
          aria-label="Previous panel"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Panel image */}
        <div
          className="flex items-center justify-center w-full h-full"
          style={{ opacity: fading ? 0 : 1, transition: "opacity 200ms ease" }}
        >
          <div className="relative max-w-4xl w-full">
            <img
              src={panel.imageData}
              alt={`Panel ${current + 1}`}
              className="w-full rounded-xl shadow-2xl"
              style={{
                maxHeight: "calc(100vh - 280px)",
                objectFit: "contain",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.7)",
              }}
            />
          </div>
        </div>

        {/* Next button */}
        <button
          onClick={next}
          disabled={current === panels.length - 1}
          className="absolute right-5 h-12 w-12 rounded-full flex items-center justify-center text-white/70 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
          data-testid="reviewer-next"
          aria-label="Next panel"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Caption + dialogue */}
      <div
        className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-4 text-center z-10"
        style={{ opacity: fading ? 0 : 1, transition: "opacity 200ms ease" }}
      >
        {panel.caption && (
          <p className="text-white/80 text-sm font-medium mb-1 tracking-wide">{panel.caption}</p>
        )}
        {panel.dialogue && (
          <p className="text-white/50 text-sm italic">&ldquo;{panel.dialogue}&rdquo;</p>
        )}
        {/* Dot nav */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {panels.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`rounded-full transition-all ${
                i === current
                  ? "w-5 h-1.5 bg-white"
                  : "w-1.5 h-1.5 bg-white/30 hover:bg-white/50"
              }`}
              aria-label={`Go to panel ${i + 1}`}
            />
          ))}
        </div>
        <p className="text-white/25 text-xs mt-3">← → Space to navigate · Esc to exit</p>
      </div>
    </div>
  );
}
