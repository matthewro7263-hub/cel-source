import { pgTable, text, integer , serial, boolean} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// 1. Continuity Tracker
export const lor_continuity_facts = pgTable("lor_continuity_facts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  category: text("category").notNull().default("character"), // character | prop | location | rule
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  imageData: text("image_data"), // optional base64
  createdAt: text("created_at").notNull().default(""),
});
export const insertLorContinuityFactSchema = createInsertSchema(lor_continuity_facts).omit({ id: true, createdAt: true });
export type InsertLorContinuityFact = z.infer<typeof insertLorContinuityFactSchema>;
export type LorContinuityFact = typeof lor_continuity_facts.$inferSelect;
export type LorFact = LorContinuityFact;

// 3. Color Palette Matcher
export const lor_palettes = pgTable("lor_palettes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull().default("Palette"),
  colors: text("colors").notNull(), // JSON array of hex strings
  createdAt: text("created_at").notNull().default(""),
});
export const insertLorPaletteSchema = createInsertSchema(lor_palettes).omit({ id: true, createdAt: true });
export type InsertLorPalette = z.infer<typeof insertLorPaletteSchema>;
export type LorPalette = typeof lor_palettes.$inferSelect;

// 4. Asset Revision Tree
export const lor_asset_versions = pgTable("lor_asset_versions", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  versionNum: integer("version_num").notNull(),
  fileData: text("file_data").notNull(),
  approved: boolean("approved").notNull().default(false),
  uploadedAt: text("uploaded_at").notNull().default(""),
});
export const insertLorAssetVersionSchema = createInsertSchema(lor_asset_versions).omit({ id: true, uploadedAt: true });
export type InsertLorAssetVersion = z.infer<typeof insertLorAssetVersionSchema>;
export type LorAssetVersion = typeof lor_asset_versions.$inferSelect;

// 5. Casting Matrix
export const lor_casting_matrix = pgTable("lor_casting_matrix", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  sceneId: integer("scene_id").notNull(),
  entityId: integer("entity_id").notNull(), // maps to lor_continuity_facts.id
  present: boolean("present").notNull().default(false),
});
export const insertLorCastingMatrixSchema = createInsertSchema(lor_casting_matrix).omit({ id: true });
export type InsertLorCastingMatrix = z.infer<typeof insertLorCastingMatrixSchema>;
export type LorCastingMatrix = typeof lor_casting_matrix.$inferSelect;
