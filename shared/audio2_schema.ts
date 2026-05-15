import { pgTable, integer, text, serial, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const audio2_lipsync = pgTable("audio2_lipsync", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  transcript: text("transcript").notNull(),
  timelineJson: text("timeline_json").notNull(), // JSON array of {viseme, startMs, endMs}
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertAudio2LipsyncSchema = createInsertSchema(audio2_lipsync, {
  id: () => z.number().optional(),
}).omit({
  id: true,
  createdAt: true,
});
export type InsertAudio2Lipsync = z.infer<typeof insertAudio2LipsyncSchema>;
export type Audio2Lipsync = typeof audio2_lipsync.$inferSelect;


export const audio2_cues = pgTable("audio2_cues", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  timestampMs: integer("timestamp_ms").notNull(),
  label: text("label").notNull(),
  color: text("color").notNull().default("#9DD0FF"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertAudio2CueSchema = createInsertSchema(audio2_cues, {
  id: () => z.number().optional(),
}).omit({
  id: true,
  createdAt: true,
});
export type InsertAudio2Cue = z.infer<typeof insertAudio2CueSchema>;
export type Audio2Cue = typeof audio2_cues.$inferSelect;
