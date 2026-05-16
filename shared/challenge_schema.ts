import { pgTable, text, timestamp, integer , serial} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const challenge_prompts = pgTable("challenge_prompts", {
  id: serial("id").primaryKey(),
  weekNumber: integer("week_number").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const challenge_submissions = pgTable("challenge_submissions", {
  id: serial("id").primaryKey(),
  promptId: integer("prompt_id").notNull(),
  userId: integer("user_id").notNull(),
  imageUrl: text("image_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const challenge_reactions = pgTable("challenge_reactions", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull(),
  userId: integer("user_id").notNull(),
  sticker: text("sticker").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertChallengeSubmissionSchema = createInsertSchema(challenge_submissions).omit({
  id: true,
  createdAt: true,
  userId: true, // we get this from the session
});

export const insertChallengeReactionSchema = createInsertSchema(challenge_reactions).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export type InsertChallengeSubmission = z.infer<typeof insertChallengeSubmissionSchema>;
export type InsertChallengeReaction = z.infer<typeof insertChallengeReactionSchema>;
export type ChallengeSubmission = typeof challenge_submissions.$inferSelect;
export type ChallengeReaction = typeof challenge_reactions.$inferSelect;
export type ChallengePrompt = typeof challenge_prompts.$inferSelect;
