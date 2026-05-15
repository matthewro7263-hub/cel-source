import { pgTable, integer, text , serial} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const approval_signoffs = pgTable("approval_signoffs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  milestone: text("milestone").notNull(), // 'storyboard' | 'animatic' | 'final'
  status: text("status").notNull().default("pending"),
  approverName: text("approver_name"),
  signature: text("signature"),
  signatureHash: text("signature_hash"),
  notes: text("notes"),
  approvedAt: text("approved_at"),
  createdAt: text("created_at").notNull(),
});

export const insertApprovalSignoffSchema = createInsertSchema(approval_signoffs).omit({
  id: true,
});
export type InsertApprovalSignoff = z.infer<typeof insertApprovalSignoffSchema>;
export type ApprovalSignoff = typeof approval_signoffs.$inferSelect;
