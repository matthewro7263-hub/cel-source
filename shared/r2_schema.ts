// shared/r2_schema.ts
// Drizzle schema additions for account auth + R2 file tracking.
// Merge these into your existing shared/schema.ts (or import alongside).
// Targets Postgres (matches drizzle-orm + connect-pg-simple in package.json).

import { pgTable, text, uuid, timestamp, bigint, index } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    username: text("username").unique(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name"),
    avatarKey: text("avatar_key"), // R2 object key, optional
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index("users_email_idx").on(t.email),
  })
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull().unique(),          // R2 object key (uploads/<userId>/...)
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    prefix: text("prefix"),                        // logical folder (avatars, attachments, etc.)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("files_user_idx").on(t.userId),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type FileRow = typeof files.$inferSelect;
export type NewFileRow = typeof files.$inferInsert;
