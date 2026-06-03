import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

interface LiveLeaderboardRow {
  submissionId: number;
  userId: number;
  imageUrl: string | null;
  notes: string | null;
  totalReactions: number;
}

interface Props {
  weekNumber: number;
  /** If true, fetches the persisted snapshot for a closed week instead of live data. */
  useSnapshot?: boolean;
}

// ─── constants ────────────────────────────────────────────────────────────────

const MEDALS = ["🥇", "🥈", "🥉"] as const;

const RANK_STYLES: Record<number, string> = {
  1: "border-yellow-400/60 bg-yellow-400/5",
  2: "border-zinc-400/60 bg-zinc-400/5",
  3: "border-amber-600/60 bg-amber-600/5",
};

// ─── component ────────────────────────────────────────────────────────────────

export default function ChallengeLeaderboard({ weekNumber, useSnapshot = false }: Props) {
  const endpoint = useSnapshot
    ? `/api/challenges/leaderboard/snapshot?week=${weekNumber}`
    : `/api/challenges/leaderboard?week=${weekNumber}&limit=10`;

  const { data: rows = [], isLoading } = useQuery<LiveLeaderboardRow[]>({
    queryKey: [useSnapshot ? "/api/challenges/leaderboard/snapshot" : "/api/challenges/leaderboard", weekNumber],
    queryFn: async () => {
      const res = await apiRequest("GET", endpoint);
      return res.json();
    },
    // Live board refreshes every 60 s; snapshot is stable once written.
    refetchInterval: useSnapshot ? false : 60_000,
  });

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-yellow-400" />
            Week {weekNumber} Leaderboard
          </CardTitle>
          {!useSnapshot && (
            <Badge variant="secondary" className="text-[10px] font-mono">
              LIVE
            </Badge>
          )}
          {useSnapshot && (
            <Badge variant="outline" className="text-[10px] font-mono">
              FINAL
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No submissions yet this week.
          </p>
        )}

        {/* Leaderboard rows */}
        {!isLoading && rows.length > 0 && (
          <ol className="space-y-1.5">
            {rows.map((row, i) => {
              const rank = i + 1;
              const medalOrRank = i < 3 ? MEDALS[i] : `#${rank}`;
              const rankStyle = RANK_STYLES[rank] ?? "";

              return (
                <li
                  key={row.submissionId}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${rankStyle}`}
                >
                  {/* Rank */}
                  <span
                    className="w-7 shrink-0 text-center text-base leading-none"
                    aria-label={`Rank ${rank}`}
                  >
                    {medalOrRank}
                  </span>

                  {/* Thumbnail */}
                  {row.imageUrl ? (
                    <img
                      src={row.imageUrl}
                      alt="Submission thumbnail"
                      className="h-8 w-8 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div
                      className="h-8 w-8 shrink-0 rounded border border-dashed bg-muted/40"
                      aria-hidden="true"
                    />
                  )}

                  {/* Notes / label */}
                  <span className="flex-1 truncate text-muted-foreground">
                    {row.notes ? (
                      <span className="text-foreground">{row.notes}</span>
                    ) : (
                      <span className="italic">Artist #{row.userId}</span>
                    )}
                  </span>

                  {/* Reaction count */}
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {row.totalReactions}
                    <span className="ml-0.5 text-primary">✦</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
