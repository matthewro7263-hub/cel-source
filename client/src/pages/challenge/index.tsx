import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChallengePrompt, ChallengeSubmission } from "../../../../shared/challenge_schema";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ChallengeLeaderboard from "./Leaderboard";
import { Sparkles, Zap, Users } from "lucide-react";
import { SpeedrunCountdown } from "@/components/SpeedrunCountdown";
import { useSpeedrunParticipants } from "@/hooks/useSpeedrunParticipants";

type Sticker = "spark" | "heart" | "study" | "wow";

interface ChallengeFeedItem extends ChallengeSubmission {
  prompt: ChallengePrompt | null;
  reactionCounts: Record<string, number>;
  myReaction: Sticker | null;
}

const STICKERS: { id: Sticker; label: string }[] = [
  { id: "spark", label: "Spark" },
  { id: "heart", label: "Heart" },
  { id: "study", label: "Study" },
  { id: "wow",   label: "Wow"   },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the Date when a speedrun prompt's submission window closes. */
function getSpeedrunDeadline(prompt: ChallengePrompt): Date | null {
  if (!prompt.isSpeedrun || !prompt.deadlineHours) return null;
  return new Date(
    new Date(prompt.createdAt).getTime() + prompt.deadlineHours * 60 * 60 * 1000,
  );
}

/** Returns true if the speedrun window for this prompt is still open. */
function isSpeedrunOpen(prompt: ChallengePrompt): boolean {
  const deadline = getSpeedrunDeadline(prompt);
  if (!deadline) return false;
  return Date.now() < deadline.getTime();
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ChallengeFeed() {
  const { data: prompts, isLoading: promptsLoading } = useQuery<ChallengePrompt[]>({
    queryKey: ["/api/challenges/prompts"],
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery<ChallengeSubmission[]>({
    queryKey: ["/api/challenges/submissions"],
  });

  const { data: feed = [], isLoading: feedLoading } = useQuery<ChallengeFeedItem[]>({
    queryKey: ["/api/challenges/feed"],
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { promptId: number; imageUrl?: string; notes?: string }) => {
      const res = await apiRequest("POST", "/api/challenges/submissions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/feed"] });
      // Refresh the live leaderboard after a new submission changes reaction totals
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/leaderboard"] });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async ({ submissionId, sticker }: { submissionId: number; sticker: Sticker }) => {
      const res = await apiRequest(
        "POST",
        `/api/challenges/submissions/${submissionId}/reactions`,
        { sticker },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/feed"] });
      // Keep leaderboard in sync after a reaction toggle
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/leaderboard"] });
    },
  });

  if (promptsLoading || submissionsLoading || feedLoading) {
    return <div className="p-8">Loading challenges...</div>;
  }

  const isSubmitted = (promptId: number) =>
    submissions?.some((s) => s.promptId === promptId);

  // Derive the current week number from the most-recent prompt.
  const currentWeek = prompts && prompts.length > 0
    ? prompts[prompts.length - 1].weekNumber
    : null;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" /> Weekly Challenges
        </h1>
        <p className="text-muted-foreground">
          Level up your skills with a new prompt every week.
        </p>
      </div>

      {/* ── Active prompts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {prompts?.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            submitted={!!isSubmitted(prompt.id)}
            onSubmit={(data) => submitMutation.mutate(data)}
            submitPending={submitMutation.isPending}
          />
        ))}
      </div>

      {/* ── Live leaderboard for the current week ── */}
      {currentWeek !== null && (
        <div className="mt-10">
          <ChallengeLeaderboard weekNumber={currentWeek} useSnapshot={false} />
        </div>
      )}

      {/* ── Submission feed ── */}
      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Submission Feed</h2>
          <span className="text-xs text-muted-foreground">
            {feed.length} local submissions
          </span>
        </div>

        {feed.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No challenge submissions yet. Mark one prompt done to start the feed.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {feed.map((submission) => (
              <Card key={submission.id}>
                <CardHeader>
                  <div className="text-xs text-muted-foreground">
                    {submission.prompt
                      ? `Week ${submission.prompt.weekNumber}`
                      : "Challenge"}{" "}
                    - Artist #{submission.userId}
                  </div>
                  <CardTitle className="text-base">
                    {submission.prompt?.title || "Challenge submission"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {submission.imageUrl ? (
                    <div className="overflow-hidden rounded-lg border bg-muted">
                      <img
                        src={submission.imageUrl}
                        alt="Challenge submission"
                        className="aspect-video w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="grid aspect-video place-items-center rounded-lg border border-dashed bg-muted/40 text-xs text-muted-foreground">
                      No artwork URL attached
                    </div>
                  )}
                  {submission.notes && (
                    <p className="text-sm text-muted-foreground">{submission.notes}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {STICKERS.map((sticker) => {
                      const active = submission.myReaction === sticker.id;
                      return (
                        <Button
                          key={sticker.id}
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className="h-8 text-xs"
                          onClick={() =>
                            reactionMutation.mutate({
                              submissionId: submission.id,
                              sticker: sticker.id,
                            })
                          }
                          disabled={reactionMutation.isPending}
                          data-testid={`button-reaction-${submission.id}-${sticker.id}`}
                        >
                          {sticker.label}{" "}
                          {submission.reactionCounts[sticker.id] || 0}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PromptCard — extracted so speedrun logic is isolated
// ---------------------------------------------------------------------------

interface PromptCardProps {
  prompt: ChallengePrompt;
  submitted: boolean;
  onSubmit: (data: { promptId: number; imageUrl?: string; notes?: string }) => void;
  submitPending: boolean;
}

function PromptCard({ prompt, submitted, onSubmit, submitPending }: PromptCardProps) {
  const deadline = getSpeedrunDeadline(prompt);
  const open = isSpeedrunOpen(prompt);

  // Only poll participants while the speedrun window is live
  const { count: participantCount } = useSpeedrunParticipants(
    prompt.id,
    prompt.isSpeedrun && open,
  );

  // A speedrun whose window is closed acts like a completed prompt
  const windowClosed = prompt.isSpeedrun && !open;
  const isDisabled = submitted || windowClosed;

  return (
    <Card className={isDisabled ? "opacity-75" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Week {prompt.weekNumber}
          </div>
          {prompt.isSpeedrun && (
            <Badge
              variant="secondary"
              className="gap-1 bg-primary/10 text-primary border-primary/20"
            >
              <Zap className="h-3 w-3" />
              Speedrun
            </Badge>
          )}
        </div>
        <CardTitle>{prompt.title}</CardTitle>
        {prompt.isSpeedrun && deadline && (
          <div className="flex items-center gap-3 mt-1">
            <SpeedrunCountdown endsAt={deadline} />
            {open && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {participantCount} animator{participantCount !== 1 ? "s" : ""} joined
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm">{prompt.body}</p>
      </CardContent>
      <CardFooter>
        {submitted ? (
          <Button variant="secondary" disabled className="w-full">
            Completed
          </Button>
        ) : windowClosed ? (
          <Button variant="secondary" disabled className="w-full">
            Window closed
          </Button>
        ) : (
          <SubmitDialog
            promptId={prompt.id}
            onSubmit={onSubmit}
            disabled={submitPending}
          />
        )}
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SubmitDialog — unchanged from original except disabled prop threaded through
// ---------------------------------------------------------------------------

function SubmitDialog({
  promptId,
  onSubmit,
  disabled,
}: {
  promptId: number;
  onSubmit: (data: any) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ promptId, imageUrl, notes });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" disabled={disabled}>
          Mark as done
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Challenge</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Artwork URL (optional)</Label>
            <Input
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              placeholder="What did you learn?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Submit
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
