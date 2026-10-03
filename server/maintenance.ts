// Scheduled housekeeping: permanently remove trash older than the retention window (the Privacy page promises
// 30 days) and stale password-reset tokens. Safe to run from several instances: every step is idempotent.
import { sql } from "drizzle-orm";
import { db } from "./db";
import { purgeTrashedItems, type TrashKind } from "./data_cleanup";
import { storage } from "./storage";

export const TRASH_RETENTION_DAYS = 30;
const BATCH = 500;

const TRASH_TABLES: Record<TrashKind, string> = { panel: "storyboard_panels", asset: "assets", scene: "scenes", script: "scripts" };

export type MaintenanceReport = Record<TrashKind, number> & { resetTokens: true };

export async function runMaintenance(now = new Date()): Promise<MaintenanceReport> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const report = { panel: 0, asset: 0, scene: 0, script: 0, resetTokens: true } as MaintenanceReport;
  // Scenes first so panels/assets that were also trashed are cleaned in the same pass.
  for (const kind of ["scene", "panel", "asset", "script"] as TrashKind[]) {
    for (;;) {
      const rows = (await db.execute(sql`SELECT id FROM ${sql.identifier(TRASH_TABLES[kind])} WHERE deleted_at IS NOT NULL AND deleted_at < ${cutoff} ORDER BY id LIMIT ${BATCH}`)).rows as { id: number }[];
      if (rows.length === 0) break;
      await purgeTrashedItems(kind, rows.map((r) => r.id));
      report[kind] += rows.length;
      if (rows.length < BATCH) break;
    }
  }
  await storage.purgeStalePasswordResetTokens();
  return report;
}

async function runAndLog() {
  try {
    const report = await runMaintenance();
    const purged = report.panel + report.asset + report.scene + report.script;
    if (purged > 0) console.log(`[maintenance] purged ${purged} trashed item(s) older than ${TRASH_RETENTION_DAYS} days`, report);
  } catch (err) {
    console.error("[maintenance] failed:", err);
  }
}

/** First run a minute after boot (so deploys stay quick), then every six hours. Timers don't keep the process alive. */
export function startMaintenance() {
  setTimeout(runAndLog, 60_000).unref();
  setInterval(runAndLog, 6 * 60 * 60 * 1000).unref();
}
