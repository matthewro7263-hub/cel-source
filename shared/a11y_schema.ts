import { pgTable, text, timestamp, integer, serial, boolean, uuid, bigint, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const a11y_user_prefs = pgTable("a11y_user_prefs", {
  userId: integer("user_id").primaryKey(),
  focusMode: integer("focus_mode").notNull().default(0),
  dyslexia: integer("dyslexia").notNull().default(0),
  colorblind: integer("colorblind").notNull().default(0),
  reducedMotion: integer("reduced_motion").notNull().default(0),
  largeTouch: integer("large_touch").notNull().default(0),
  audioCues: integer("audio_cues").notNull().default(0),
});

export const insertA11yPrefsSchema = createInsertSchema(a11y_user_prefs);
export type InsertA11yPrefs = z.infer<typeof insertA11yPrefsSchema>;
export type A11yPrefs = typeof a11y_user_prefs.$inferSelect;
