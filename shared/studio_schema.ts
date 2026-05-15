import { pgTable, integer, text, real, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== STUDIO: RENDER EVENTS =====
export const studio_render_events = pgTable("studio_render_events", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  label: text("label").notNull(),
  minutes: real("minutes").notNull(),
  cost: real("cost").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertStudioRenderEventSchema = createInsertSchema(studio_render_events, {
  id: () => z.number().optional(),
}).omit({
  id: true,
  createdAt: true,
});
export type InsertStudioRenderEvent = z.infer<typeof insertStudioRenderEventSchema>;
export type StudioRenderEvent = typeof studio_render_events.$inferSelect;

// ===== STUDIO: RENDER BUDGET =====
export const studio_render_budget = pgTable("studio_render_budget", {
  projectId: integer("project_id").primaryKey(),
  totalMinutes: real("total_minutes").notNull().default(600),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type StudioRenderBudget = typeof studio_render_budget.$inferSelect;

// ===== STUDIO: SNAPSHOTS =====
export const studio_snapshots = pgTable("studio_snapshots", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  label: text("label").notNull(),
  parentId: integer("parent_id"),
  notes: text("notes"),
  restoredFromId: integer("restored_from_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertStudioSnapshotSchema = createInsertSchema(studio_snapshots, {
  id: () => z.number().optional(),
}).omit({
  id: true,
  createdAt: true,
});
export type InsertStudioSnapshot = z.infer<typeof insertStudioSnapshotSchema>;
export type StudioSnapshot = typeof studio_snapshots.$inferSelect;

// ===== STUDIO: CREDIT ENTRIES =====
export const studio_credit_entries = pgTable("studio_credit_entries", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  section: text("section").notNull(), // 'cast' | 'crew'
  role: text("role").notNull(),
  name: text("name").notNull(),
  orderIdx: integer("order_idx").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertStudioCreditEntrySchema = createInsertSchema(studio_credit_entries, {
  id: () => z.number().optional(),
}).omit({
  id: true,
  createdAt: true,
});
export type InsertStudioCreditEntry = z.infer<typeof insertStudioCreditEntrySchema>;
export type StudioCreditEntry = typeof studio_credit_entries.$inferSelect;
