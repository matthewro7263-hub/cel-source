import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const challenge_prompts = sqliteTable("challenge_prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekNumber: integer("week_number").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});

export const challenge_submissions = sqliteTable("challenge_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  promptId: integer("prompt_id").notNull(),
  userId: integer("user_id").notNull(),
  imageUrl: text("image_url"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

export const challenge_reactions = sqliteTable("challenge_reactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submissionId: integer("submission_id").notNull(),
  userId: integer("user_id").notNull(),
  sticker: text("sticker").notNull(),
  createdAt: text("created_at").notNull(),
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
