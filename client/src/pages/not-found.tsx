import { Link } from "wouter";
import { Home, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center landing-root relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 z-0 landing-bg landing-dot-grid pointer-events-none" />

      <div className="relative z-10 text-center px-6 max-w-lg mx-auto">
        {/* Branded illustration - missing filmstrip frame */}
        <div className="mb-8 flex justify-center">
          <svg width="200" height="200" viewBox="0 0 200 200" className="opacity-80">
            <defs>
              <linearGradient id="filmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#9DD0FF" />
                <stop offset="50%" stopColor="#C4B5FD" />
                <stop offset="100%" stopColor="#FFD9A8" />
              </linearGradient>
            </defs>
            {/* Filmstrip frame outline */}
            <rect x="30" y="40" width="140" height="120" rx="8" fill="none" stroke="url(#filmGradient)" strokeWidth="2" strokeDasharray="8 4" opacity="0.6" />
            {/* Sprocket holes - missing in middle */}
            <rect x="40" y="55" width="12" height="12" rx="3" fill="#9DD0FF" opacity="0.8" />
            <rect x="148" y="55" width="12" height="12" rx="3" fill="#9DD0FF" opacity="0.8" />
            <rect x="40" y="94" width="12" height="12" rx="3" fill="#C4B5FD" opacity="0.8" />
            <rect x="148" y="94" width="12" height="12" rx="3" fill="#C4B5FD" opacity="0.8" />
            <rect x="40" y="133" width="12" height="12" rx="3" fill="#FFD9A8" opacity="0.8" />
            <rect x="148" y="133" width="12" height="12" rx="3" fill="#FFD9A8" opacity="0.8" />
            {/* Question mark in center */}
            <text x="100" y="115" textAnchor="middle" fontSize="48" fontWeight="bold" fill="url(#filmGradient)">?</text>
          </svg>
        </div>

        {/* Welcoming copy */}
        <h1 className="font-display text-4xl font-bold mb-4 tracking-tight">
          Frame not found
        </h1>
        <p className="text-lg text-on-surface/70 mb-8 leading-relaxed">
          Looks like this scene got cut from the reel. Let's get you back to the studio.
        </p>

        {/* Animated CTA */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 btn-sky-halo px-6 py-3 rounded-full font-semibold text-base hover:translate-y-[-2px] transition-all duration-200"
        >
          <Home className="w-4 h-4" />
          Return to Home
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
