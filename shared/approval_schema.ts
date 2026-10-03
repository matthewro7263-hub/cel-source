import { pgTable, integer, text, serial, timestamp, boolean, index} from "drizzle-orm/pg-core";
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
  approvedAt: timestamp("approved_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  approvalSignoffsProjectIdIdx: index("approval_signoffs_project_id_idx").on(table.projectId),
}));

export const insertApprovalSignoffSchema = createInsertSchema(approval_signoffs, {
  id: () => z.number().optional(),
}).omit({
  id: true,
});
export type InsertApprovalSignoff = z.infer<typeof insertApprovalSignoffSchema>;
export type ApprovalSignoff = typeof approval_signoffs.$inferSelect;
