// Fails when the Drizzle schema (shared/*.ts) and the database produced by the SQL migrations disagree:
// a declared table/column/index that doesn't exist in the migrated DB is exactly the bug class that made
// quote_cents and other columns missing on fresh installs. Runs against DATABASE_URL after the app booted.
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import pg from "pg";
import * as main from "../../shared/schema";
import * as a11y from "../../shared/a11y_schema";
import * as approval from "../../shared/approval_schema";
import * as audio2 from "../../shared/audio2_schema";
import * as biz from "../../shared/biz_schema";
import * as leaderboard from "../../shared/challenge_leaderboard_schema";
import * as challenge from "../../shared/challenge_schema";
import * as lor from "../../shared/lor_schema";
import * as studio from "../../shared/studio_schema";

const tables = new Map<string, ReturnType<typeof getTableConfig>>();
for (const mod of [main, a11y, approval, audio2, biz, leaderboard, challenge, lor, studio]) {
  for (const value of Object.values(mod)) if (is(value, PgTable)) { const cfg = getTableConfig(value); tables.set(cfg.name, cfg); }
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const columns = new Map<string, Map<string, { nullable: boolean; type: string }>>();
for (const r of (await db.query("select table_name, column_name, is_nullable, data_type from information_schema.columns where table_schema='public'")).rows) {
  if (!columns.has(r.table_name)) columns.set(r.table_name, new Map());
  columns.get(r.table_name)!.set(r.column_name, { nullable: r.is_nullable === "YES", type: r.data_type });
}
const indexes = new Map<string, string>(); // index name -> "col1,col2"
const indexesByTable = new Map<string, string[]>(); // table -> ["col1,col2", ...]
for (const r of (await db.query(`
  select i.relname as name, t.relname as tbl, string_agg(a.attname, ',' order by k.ord) as cols
  from pg_index x join pg_class i on i.oid = x.indexrelid join pg_class t on t.oid = x.indrelid
  join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
  cross join lateral unnest(x.indkey) with ordinality as k(attnum, ord)
  join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
  group by i.relname, t.relname`)).rows) {
  indexes.set(r.name, r.cols);
  indexesByTable.set(r.tbl, [...(indexesByTable.get(r.tbl) ?? []), r.cols]);
}
await db.end();

const problems: string[] = [];
for (const [name, cfg] of tables) {
  const have = columns.get(name);
  if (!have) { problems.push(`table ${name} is in the schema but not in the migrated database`); continue; }
  for (const col of cfg.columns) {
    const actual = have.get(col.name);
    if (!actual) { problems.push(`${name}.${col.name} is in the schema but not in the database`); continue; }
    // NOT NULL drift matters: the app would insert NULLs the database rejects (or vice versa).
    if (col.notNull && actual.nullable && !col.primary) problems.push(`${name}.${col.name} is NOT NULL in the schema but nullable in the database`);
  }
  for (const idx of cfg.indexes) {
    const idxName = idx.config.name;
    const expected = idx.config.columns.map((c: any) => c.name).join(",");
    const actual = indexes.get(idxName);
    if (actual === undefined) problems.push(`index ${idxName} on ${name}(${expected}) is in the schema but not in the database`);
    else if (actual !== expected) problems.push(`index ${idxName} covers (${actual}) in the database but (${expected}) in the schema`);
  }
}
// Columns every API list query filters by must lead some index (catches the next forgotten table).
for (const [name, have] of columns) {
  if (!tables.has(name)) continue;
  for (const col of ["project_id", "scene_id", "user_id"]) {
    if (have.has(col) && !(indexesByTable.get(name) ?? []).some((cols) => cols.split(",")[0] === col)) {
      problems.push(`${name}.${col} has no index leading with it`);
    }
  }
}

if (problems.length) {
  console.log(problems.map((p) => "FAIL: " + p).join("\n"));
  console.log(`\n0 passed, ${problems.length} failed`);
  process.exit(1);
}
console.log(`${tables.size} tables checked: every declared table, column and index exists in the migrated database.\n\n${tables.size} passed, 0 failed`);
