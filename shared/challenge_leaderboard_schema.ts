import { pgTable, text, timestamp, integer, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Denormalised weekly snapshot written by the Sunday-night cron.
// Read by GET /api/challenges/leaderboard/snapshot?week=N.
// The live query (current open week) skips this table and hits challenge_reactions
// directly so the board always shows real-time counts during the active window.
export const challenge_leaderboard_snapshots = pgTable(
  "challenge_leaderboard_snapshots",
  {
    id: serial("id").primaryKey(),
    weekNumber: integer("week_number").notNull(),
    userId: integer("user_id").notNull(),
    submissionId: integer("submission_id").notNull(),
    rank: integer("rank").notNull(),                // 1 = top of that week
    totalReactions: integer("total_reactions").notNull().default(0),
    topSticker: text("top_sticker"),                // winning sticker emoji key
    snapshotAt: timestamp("snapshot_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);

export const insertChallengeLeaderboardSnapshotSchema = createInsertSchema(
  challenge_leaderboard_snapshots
).omit({ id: true });

export type InsertChallengeLeaderboardSnapshot = z.infer<
  typeof insertChallengeLeaderboardSnapshotSchema
>;
export type ChallengeLeaderboardSnapshot =
  typeof challenge_leaderboard_snapshots.$inferSelect;
