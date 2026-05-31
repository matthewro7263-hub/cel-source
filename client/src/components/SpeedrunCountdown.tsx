import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpeedrunCountdownProps {
  endsAt: Date;
  className?: string;
}

/**
 * Displays a live HH:MM:SS countdown to a speedrun deadline.
 * Updates every second via setInterval; cleans up on unmount.
 * When the window expires, shows a static "Window closed" badge in red.
 */
export function SpeedrunCountdown({ endsAt, className }: SpeedrunCountdownProps) {
  const [msLeft, setMsLeft] = useState<number>(() => endsAt.getTime() - Date.now());

  useEffect(() => {
    // Re-sync on mount in case endsAt changed
    setMsLeft(endsAt.getTime() - Date.now());

    const id = setInterval(() => {
      setMsLeft(endsAt.getTime() - Date.now());
    }, 1000);

    return () => clearInterval(id);
  }, [endsAt]);

  if (msLeft <= 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-mono font-semibold text-destructive",
          className,
        )}
      >
        <Timer className="h-3 w-3" />
        Window closed
      </span>
    );
  }

  const totalSeconds = Math.floor(msLeft / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  // Turn amber when < 1 hour left
  const urgent = hours === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-mono font-semibold tabular-nums",
        urgent ? "text-amber-500" : "text-muted-foreground",
        className,
      )}
    >
      <Timer className="h-3 w-3" />
      {hh}:{mm}:{ss} left
    </span>
  );
}
