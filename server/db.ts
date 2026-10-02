// server/db.ts
// Database connection. Neon's serverless driver speaks WebSockets and only works
// against Neon (or a Neon proxy), so for any other Postgres (local dev, Render,
// Supabase, ...) we use the standard node-postgres driver instead.
//
// CEL_DB_DRIVER=neon|pg forces a choice; otherwise *.neon.tech hosts use Neon.

import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import pg from "pg";
import ws from "ws";

import * as mainSchema from "@shared/schema";
import * as a11ySchema from "@shared/a11y_schema";
import * as challengeSchema from "@shared/challenge_schema";
import * as challengeLeaderboardSchema from "@shared/challenge_leaderboard_schema";
import * as lorSchema from "@shared/lor_schema";
import * as studioSchema from "@shared/studio_schema";

const schema = {
  ...mainSchema,
  ...a11ySchema,
  ...challengeSchema,
  ...challengeLeaderboardSchema,
  ...lorSchema,
  ...studioSchema,
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

function chooseDriver(url: string): "neon" | "pg" {
  const forced = process.env.CEL_DB_DRIVER;
  if (forced === "neon" || forced === "pg") return forced;
  try {
    return new URL(url).hostname.endsWith(".neon.tech") ? "neon" : "pg";
  } catch {
    return "pg";
  }
}

export const dbDriver = chooseDriver(connectionString);

// Both pools expose the same connect()/query()/end() surface we use.
export type DbPool = pg.Pool;
export type Db = NeonDatabase<typeof schema>;

let pool: DbPool;
let db: Db;
let runMigrationsFolder: (folder: string) => Promise<void>;

if (dbDriver === "neon") {
  neonConfig.webSocketConstructor = ws;
  const neonPool = new NeonPool({ connectionString });
  pool = neonPool as unknown as DbPool;
  db = drizzleNeon(neonPool, { schema });
  runMigrationsFolder = (folder) => migrateNeon(drizzleNeon(neonPool), { migrationsFolder: folder });
} else {
  const pgPool = new pg.Pool({
    connectionString,
    // Managed Postgres (Render, Supabase, ...) requires TLS; local servers don't offer it.
    ssl: /sslmode=(require|verify)/.test(connectionString) || process.env.PGSSLMODE === "require"
      ? { rejectUnauthorized: false }
      : undefined,
  });
  pool = pgPool;
  db = drizzlePg(pgPool, { schema }) as unknown as Db;
  runMigrationsFolder = (folder) => migratePg(drizzlePg(pgPool), { migrationsFolder: folder });
}

// An idle client dropping (DB restart, network blip) emits 'error' on the pool; without a listener
// Node treats it as an uncaught exception and kills the whole server.
pool.on("error", (err) => console.error("[db] idle client error:", err.message));

export { pool, db };
export const migrateDatabase = (folder: string) => runMigrationsFolder(folder);
