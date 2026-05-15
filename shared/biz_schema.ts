import { pgTable, integer, text, real , serial} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== BIZ: FESTIVAL SUBMISSIONS =====
export const biz_festivals = pgTable("biz_festivals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  deadline: text("deadline"),
  status: text("status").notNull().default("planned"),
  fee: real("fee").default(0),
  notes: text("notes"),
  projectId: integer("project_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertBizFestivalSchema = createInsertSchema(biz_festivals).omit({ id: true, createdAt: true });
export type InsertBizFestival = z.infer<typeof insertBizFestivalSchema>;
export type BizFestival = typeof biz_festivals.$inferSelect;

// ===== BIZ: CONTRACT TEMPLATES =====
export const biz_contracts = pgTable("biz_contracts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // commission|nda|model_release
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertBizContractSchema = createInsertSchema(biz_contracts).omit({ id: true, createdAt: true });
export type InsertBizContract = z.infer<typeof insertBizContractSchema>;
export type BizContract = typeof biz_contracts.$inferSelect;

// ===== BIZ: EXPENSES =====
export const biz_expenses = pgTable("biz_expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  projectId: integer("project_id"),
  date: text("date").notNull(),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  notes: text("notes"),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertBizExpenseSchema = createInsertSchema(biz_expenses).omit({ id: true, createdAt: true });
export type InsertBizExpense = z.infer<typeof insertBizExpenseSchema>;
export type BizExpense = typeof biz_expenses.$inferSelect;
