// v4 Achievements page
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy, Star, Award, Crown, Flame, Moon, Sun, Share2, Users,
  MessageSquare, FolderOpen, Film, Image, LayoutGrid, DollarSign,
  Clapperboard,
} from "lucide-react";

interface AchievementEntry {
  code: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
  locked: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  FolderOpen, Film, Image, LayoutGrid, Star, Crown,
  Clapperboard, DollarSign, Award, Moon, Sun, Flame,
  Share2, Users, MessageSquare, Trophy,
};

function AchievementIcon({ name, className }: { name: string; className?: string }) {
  const Comp = ICON_MAP[name] || Trophy;
  return <Comp className={className} />;
}

export default function Achievements() {
  const { data: achievements, isLoading } = useQuery<AchievementEntry[]>({
    queryKey: ["/api/achievements"],
  });

  if (isLoading) {
    return (
      <div className="px-6 lg:px-10 py-8 max-w-4xl mx-auto">
        <div className="h-7 w-48 bg-muted rounded animate-pulse mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const unlocked = achievements?.filter((a) => !a.locked) ?? [];
  const locked = achievements?.filter((a) => a.locked) ?? [];

  return (
    <div className="px-6 lg:px-10 py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold tracking-tight mb-1" data-testid="heading-achievements">
          Achievements
        </h1>
        <p className="text-sm text-muted-foreground">
          {unlocked.length} of {achievements?.length ?? 0} unlocked
        </p>
      </div>

      {unlocked.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Unlocked</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {unlocked.map((a) => (
              <AchievementCard key={a.code} achievement={a} />
            ))}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Locked</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {locked.map((a) => (
              <AchievementCard key={a.code} achievement={a} />
            ))}
          </div>
        </div>
      )}

      {(!achievements || achievements.length === 0) && (
        <div className="text-center py-16 text-muted-foreground">
          <Trophy size={32} className="mx-auto mb-3 opacity-30" />
          <p>No achievements yet. Start building!</p>
        </div>
      )}
    </div>
  );
}

// === AGENT_5 ADDITIONS ===
// Add styles for holographic card

function AchievementCard({ achievement }: { achievement: AchievementEntry }) {
  const isUnlocked = !achievement.locked;
  // === AGENT_5 ADDITIONS START ===
  const [flipped, setFlipped] = useState(false);
  
  if (isUnlocked) {
    return (
      <div 
        className="relative group cursor-pointer perspective-1000 w-full h-36"
        onClick={() => setFlipped(!flipped)}
      >
        <div 
          className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden rounded-xl border border-primary/30 bg-card shadow-sm p-4 flex flex-col items-center text-center gap-2 overflow-hidden">
            {/* Holographic background pseudo-element */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none mix-blend-screen bg-gradient-to-tr from-[#ff0080] via-[#7928ca] to-[#00f0ff]" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')]" />
            
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/15 text-primary relative z-10">
              <AchievementIcon name={achievement.icon} className="w-5 h-5" />
            </div>
            <div className="font-semibold text-sm leading-tight relative z-10">{achievement.name}</div>
          </div>
          
          {/* Back */}
          <div className="absolute inset-0 backface-hidden rounded-xl border border-primary/30 bg-card shadow-sm p-4 flex flex-col items-center justify-center text-center rotate-y-180">
            <div className="text-xs text-muted-foreground leading-snug">{achievement.description}</div>
            {achievement.unlockedAt && (
              <div className="text-[10px] text-muted-foreground/70 mt-2">
                Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  // === AGENT_5 ADDITIONS END ===

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col items-center text-center gap-2 transition-all ${
        isUnlocked
          ? "border-primary/30 bg-card shadow-sm"
          : "border-border bg-muted/30 opacity-50 grayscale"
      }`}
      data-testid={`achievement-${achievement.code}`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isUnlocked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        <AchievementIcon name={achievement.icon} className="w-5 h-5" />
      </div>
      <div className="font-semibold text-sm leading-tight">{achievement.name}</div>
      <div className="text-xs text-muted-foreground leading-snug">{achievement.description}</div>
      {isUnlocked && achievement.unlockedAt && (
        <div className="text-[10px] text-muted-foreground/70 mt-auto">
          {new Date(achievement.unlockedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
