import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const audio2_lipsync = sqliteTable("audio2_lipsync", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  transcript: text("transcript").notNull(),
  timelineJson: text("timeline_json").notNull(), // JSON array of {viseme, startMs, endMs}
  createdAt: text("created_at").notNull(),
});
export const insertAudio2LipsyncSchema = createInsertSchema(audio2_lipsync).omit({
  id: true,
  projectId: true,
  createdAt: true,
});
export type InsertAudio2Lipsync = z.infer<typeof insertAudio2LipsyncSchema>;
export type Audio2Lipsync = typeof audio2_lipsync.$inferSelect;


export const audio2_cues = sqliteTable("audio2_cues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  timestampMs: integer("timestamp_ms").notNull(),
  label: text("label").notNull(),
  color: text("color").notNull().default("#9DD0FF"),
  createdAt: text("created_at").notNull(),
});
export const insertAudio2CueSchema = createInsertSchema(audio2_cues).omit({
  id: true,
  projectId: true,
  createdAt: true,
});
export type InsertAudio2Cue = z.infer<typeof insertAudio2CueSchema>;
export type Audio2Cue = typeof audio2_cues.$inferSelect;
