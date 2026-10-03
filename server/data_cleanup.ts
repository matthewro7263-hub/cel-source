// Complete deletion of a project's or an account's data.
//
// The schema has no foreign-key constraints, so nothing cascades by itself; every table that points at a
// project (directly or through a parent row) has to be listed here. Without this a "deleted" project left
// its assets, AI key, snapshots, chat history and more behind forever.
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { deleteObject, listUserObjects } from "./r2";

/** Tables with a `project_id` column. Children of these rows are handled explicitly below. */
const PROJECT_TABLES = [
  "ai_chat_sessions", "animatic_projects", "animatics", "approval_signoffs", "assets", "aud_voice_takes",
  "audio2_cues", "audio2_lipsync", "bak_snapshots", "biz_expenses", "biz_festivals", "cli_approvals", "cli_feedback",
  "comments", "commission_pricing_presets", "inbox_items", "lor_casting_matrix", "lor_continuity_facts", "lor_palettes",
  "project_ai_keys", "project_members", "scenes", "scripts", "storyboards", "studio_credit_entries",
  "studio_render_budget", "studio_render_events", "studio_snapshots",
] as const;

/** Deleted accounts keep their row (anonymised) with an address on a reserved, undeliverable domain. */
export const isDeletedAccount = (user: { email: string }) => user.email.endsWith("@deleted.invalid");

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const inScenes = (id: number) => sql`(SELECT id FROM scenes WHERE project_id = ${id})`;
const inAssets = (id: number) => sql`(SELECT id FROM assets WHERE project_id = ${id})`;
const inStoryboards = (id: number) => sql`(SELECT id FROM storyboards WHERE project_id = ${id})`;
const inPanels = (id: number) => sql`(SELECT id FROM storyboard_panels WHERE storyboard_id IN ${inStoryboards(id)})`;
const inAnimatics = (id: number) => sql`(SELECT id FROM animatic_projects WHERE project_id = ${id})`;

/** R2 object keys that belong to a project (read before the rows are deleted). */
async function projectObjectKeys(tx: Tx, id: number): Promise<string[]> {
  const rows = await tx.execute(sql`
    SELECT r2_key AS key FROM storyboard_panels WHERE storyboard_id IN ${inStoryboards(id)} AND r2_key IS NOT NULL AND r2_key <> ''
    UNION SELECT r2_key FROM assets WHERE project_id = ${id} AND r2_key IS NOT NULL AND r2_key <> ''
    UNION SELECT original_key FROM scripts WHERE project_id = ${id} AND original_key IS NOT NULL AND original_key <> ''`);
  return (rows.rows as { key: string }[]).map((r) => r.key);
}

async function deleteProjectRows(tx: Tx, id: number) {
  await tx.execute(sql`DELETE FROM ai_chat_messages WHERE session_id IN (SELECT id FROM ai_chat_sessions WHERE project_id = ${id})`);
  await tx.execute(sql`DELETE FROM animatic_clips WHERE track_id IN (SELECT id FROM animatic_tracks WHERE animatic_project_id IN ${inAnimatics(id)})`);
  await tx.execute(sql`DELETE FROM animatic_tracks WHERE animatic_project_id IN ${inAnimatics(id)}`);
  await tx.execute(sql`DELETE FROM aud_captions WHERE animatic_project_id IN ${inAnimatics(id)}`);
  for (const table of ["bak_gltf_exports", "renders", "scene_time_entries"]) {
    await tx.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE scene_id IN ${inScenes(id)}`);
  }
  await tx.execute(sql`DELETE FROM panel_pins WHERE panel_id IN ${inPanels(id)}`);
  await tx.execute(sql`DELETE FROM storyboard_panels WHERE storyboard_id IN ${inStoryboards(id)}`);
  await tx.execute(sql`DELETE FROM lor_asset_versions WHERE asset_id IN ${inAssets(id)}`);
  await tx.execute(sql`
    DELETE FROM tag_assignments WHERE
      (entity_kind = 'scene' AND entity_id IN ${inScenes(id)}) OR
      (entity_kind = 'asset' AND entity_id IN ${inAssets(id)}) OR
      (entity_kind = 'panel' AND entity_id IN ${inPanels(id)}) OR
      (entity_kind = 'inboxItem' AND entity_id IN (SELECT id FROM inbox_items WHERE project_id = ${id}))`);
  // A commission outlives the project it was converted into.
  await tx.execute(sql`UPDATE commissions SET linked_project_id = NULL WHERE linked_project_id = ${id}`);
  for (const table of PROJECT_TABLES) {
    await tx.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE project_id = ${id}`);
  }
  await tx.execute(sql`DELETE FROM projects WHERE id = ${id}`);
}

async function deleteObjectsQuietly(keys: string[]) {
  // R2 is optional; objects that can't be removed are not worth failing the user's request for.
  for (const key of keys) await deleteObject(key).catch(() => {});
}

export async function deleteProjectCascade(id: number): Promise<void> {
  let keys: string[] = [];
  await db.transaction(async (tx) => {
    keys = await projectObjectKeys(tx, id);
    await deleteProjectRows(tx, id);
  });
  await deleteObjectsQuietly(keys);
}

/**
 * Deletes everything an account owns and anonymises the user row itself. The row is kept (not removed) so
 * comments and activity the user left in other people's projects still resolve to "Deleted user".
 */
export async function deleteAccountData(userId: number, replacementPasswordHash: string): Promise<void> {
  const owned = (await db.execute(sql`SELECT id FROM projects WHERE owner_id = ${userId}`)).rows as { id: number }[];
  for (const { id } of owned) await deleteProjectCascade(id);

  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM tag_assignments WHERE tag_id IN (SELECT id FROM tags WHERE user_id = ${userId})`);
    await tx.execute(sql`DELETE FROM tags WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM commission_line_items WHERE commission_id IN (SELECT id FROM commissions WHERE owner_user_id = ${userId})`);
    await tx.execute(sql`DELETE FROM dlt_commission_hours WHERE commission_id IN (SELECT id FROM commissions WHERE owner_user_id = ${userId})`);
    await tx.execute(sql`DELETE FROM commissions WHERE owner_user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM challenge_reactions WHERE user_id = ${userId} OR submission_id IN (SELECT id FROM challenge_submissions WHERE user_id = ${userId})`);
    await tx.execute(sql`DELETE FROM challenge_leaderboard_snapshots WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM challenge_submissions WHERE user_id = ${userId}`);
    for (const table of ["a11y_user_prefs", "achievements", "user_activity_log", "biz_contracts", "biz_expenses", "biz_festivals", "inbox_items", "scene_time_entries", "project_members", "password_reset_tokens"]) {
      await tx.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE user_id = ${userId}`);
    }
    await tx.execute(sql`UPDATE scenes SET assignee_id = NULL WHERE assignee_id = ${userId}`);
    await tx.execute(sql`
      UPDATE users SET
        email = ${`deleted-${userId}-${randomBytes(4).toString("hex")}@deleted.invalid`},
        name = 'Deleted user',
        avatar_color = '#9CA3AF',
        password_hash = ${replacementPasswordHash},
        token_version = token_version + 1,
        email_notifications = false
      WHERE id = ${userId}`);
  });

  // Files this user uploaded to cloud storage (best effort; R2 is optional).
  try {
    const listing = await listUserObjects(String(userId));
    await deleteObjectsQuietly((listing.Contents ?? []).map((o) => o.Key!).filter(Boolean));
  } catch { /* not configured or unreachable */ }
}
