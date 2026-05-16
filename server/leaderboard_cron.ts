// server/leaderboard_cron.ts
// ─────────────────────────────────────────────────────────────────────────────
// Snapshot helper + Sunday-night cron wiring.
//
// Usage in server/index.ts (after seedIfEmpty):
//
//   import { startLeaderboardCron, snapshotWeekLeaderboard } from "./leaderboard_cron";
//   startLeaderboardCron();
//
// Manual one-off (e.g. Render cron job calling a POST endpoint):
//
//   await snapshotWeekLeaderboard(weekNumber);
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "./storage";
import {
  challenge_submissions,
  challenge_prompts,
  challenge_reactions,
} from "../shared/challenge_schema";
import { challenge_leaderboard_snapshots } from "../shared/challenge_leaderboard_schema";
import { eq, desc, count, asc } from "drizzle-orm";
import { log } from "./index";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Live reaction totals for a given week — no cache, always fresh. */
export async function getLiveLeaderboard(
  weekNumber: number,
  limit = 10
): Promise<
  {
    submissionId: number;
    userId: number;
    imageUrl: string | null;
    notes: string | null;
    totalReactions: number;
  }[]
> {
  const rows = await db
    .select({
      submissionId: challenge_submissions.id,
      userId: challenge_submissions.userId,
      imageUrl: challenge_submissions.imageUrl,
      notes: challenge_submissions.notes,
      totalReactions: count(challenge_reactions.id),
    })
    .from(challenge_submissions)
    .innerJoin(
      challenge_prompts,
      eq(challenge_submissions.promptId, challenge_prompts.id)
    )
    .leftJoin(
      challenge_reactions,
      eq(challenge_reactions.submissionId, challenge_submissions.id)
    )
    .where(eq(challenge_prompts.weekNumber, weekNumber))
    .groupBy(
      challenge_submissions.id,
      challenge_submissions.userId,
      challenge_submissions.imageUrl,
      challenge_submissions.notes
    )
    .orderBy(desc(count(challenge_reactions.id)))
    .limit(limit);

  return rows.map((r) => ({
    submissionId: r.submissionId,
    userId: r.userId,
    imageUrl: r.imageUrl ?? null,
    notes: r.notes ?? null,
    totalReactions: Number(r.totalReactions),
  }));
}

/** Compute the dominant sticker for one submission. */
async function topStickerForSubmission(
  submissionId: number
): Promise<string | null> {
  const rows = await db
    .select({
      sticker: challenge_reactions.sticker,
      n: count(challenge_reactions.id),
    })
    .from(challenge_reactions)
    .where(eq(challenge_reactions.submissionId, submissionId))
    .groupBy(challenge_reactions.sticker)
    .orderBy(desc(count(challenge_reactions.id)))
    .limit(1);

  return rows.length > 0 ? rows[0].sticker : null;
}

/**
 * Write a ranked snapshot for the given week into
 * challenge_leaderboard_snapshots (all 100 entries, not just top-10).
 * Idempotent: calling it twice for the same week adds duplicate rows; the
 * read endpoint always returns the most recent snapshotAt per week.
 */
export async function snapshotWeekLeaderboard(weekNumber: number): Promise<void> {
  const live = await getLiveLeaderboard(weekNumber, 100);
  if (live.length === 0) {
    log(`leaderboard_cron: no submissions for week ${weekNumber}, skipping snapshot`);
    return;
  }

  const now = new Date();
  const insertRows = await Promise.all(
    live.map(async (row, i) => ({
      weekNumber,
      userId: row.userId,
      submissionId: row.submissionId,
      rank: i + 1,
      totalReactions: row.totalReactions,
      topSticker: await topStickerForSubmission(row.submissionId),
      snapshotAt: now,
    }))
  );

  await db.insert(challenge_leaderboard_snapshots).values(insertRows);
  log(
    `leaderboard_cron: snapshotted week ${weekNumber} — ${insertRows.length} entries`
  );
}

// ─── cron wiring ─────────────────────────────────────────────────────────────

/** Returns milliseconds until next Sunday at 23:59:30 UTC. */
function msUntilNextSundayMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  // getUTCDay(): 0 = Sunday
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  next.setUTCDate(now.getUTCDate() + daysUntilSunday);
  next.setUTCHours(23, 59, 30, 0);
  return next.getTime() - now.getTime();
}

/** Compute the current ISO week number (1–53). */
function currentISOWeek(): number {
  const now = new Date();
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear =
    Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000) + 1;
  return Math.ceil(dayOfYear / 7);
}

/**
 * Start the weekly cron.  Call once from server/index.ts after startup.
 * The timer fires at the next Sunday 23:59:30 UTC then re-schedules itself
 * weekly so it never drifts.
 */
export function startLeaderboardCron(): void {
  const delay = msUntilNextSundayMidnight();
  log(
    `leaderboard_cron: next snapshot in ${Math.round(delay / 3_600_000)}h (Sunday 23:59 UTC)`
  );

  const fire = async () => {
    const week = currentISOWeek();
    try {
      await snapshotWeekLeaderboard(week);
    } catch (err) {
      console.error("[leaderboard_cron] snapshot error:", err);
    }
    // Re-schedule for 7 days later
    setTimeout(fire, 7 * 24 * 60 * 60 * 1000);
  };

  setTimeout(fire, delay);
}
