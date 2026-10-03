// Trash retention: items soft-deleted more than 30 days ago are purged with everything attached to them;
// recent trash is left alone. Also covers "delete forever" cleaning up dependents.
import pg from "pg";
import { call, check, summary, png } from "./lib.mjs";

const u = Date.now();
const signup = async (n) => (await call("POST", "/api/auth/signup", { email: `${n}${u}@example.com`, name: n, password: "password123" })).json;
const user = await signup("trash");
const admin = (await call("POST", "/api/auth/login", { email: "matthew@cel.app", password: "celdemo" })).json.token;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const n = async (sql, params) => (await db.query(sql, params)).rows[0].n;

let r = await call("POST", "/api/admin/maintenance", undefined, user.token);
check("maintenance trigger is admin-only", r.status === 403, r);
r = await call("POST", "/api/admin/maintenance");
check("maintenance trigger needs a session", r.status === 401, r);

const pid = (await call("POST", "/api/projects", { title: "Trash Project" }, user.token)).json.id;
const sceneId = (await call("POST", `/api/projects/${pid}/scenes`, { title: "Old scene", orderIdx: 0, status: "Todo" }, user.token)).json.id;
const recentScene = (await call("POST", `/api/projects/${pid}/scenes`, { title: "Recent scene", orderIdx: 1, status: "Todo" }, user.token)).json.id;
const sbId = (await call("POST", `/api/projects/${pid}/storyboards`, { title: "B" }, user.token)).json.id;
const panel = (await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: png, sceneId }, user.token)).json.id;
const keptPanel = (await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: png, sceneId }, user.token)).json.id;
await call("POST", `/api/panels/${panel}/pins`, { xPercent: 5, yPercent: 5, body: "pin on doomed panel" }, user.token);
const oldAsset = (await call("POST", `/api/projects/${pid}/assets`, { filename: "old.png", mimeType: "image/png", fileData: png }, user.token)).json.id;
const recentAsset = (await call("POST", `/api/projects/${pid}/assets`, { filename: "recent.png", mimeType: "image/png", fileData: png }, user.token)).json.id;
const script = (await call("POST", `/api/projects/${pid}/scripts`, { title: "Old script", content: "x" }, user.token)).json.id;
await call("POST", `/api/scenes/${sceneId}/timer/start`, undefined, user.token);
await call("POST", `/api/scenes/${sceneId}/timer/stop`, undefined, user.token);
await db.query("insert into renders (scene_id, label, software, status, file_url, notes, duration_seconds, created_at) values ($1,'r','Blender','done','','',1, now())", [sceneId]).catch(() => {});

for (const [what, res] of [
  ["scene", await call("DELETE", `/api/projects/${pid}/scenes/${sceneId}`, undefined, user.token)],
  ["scene2", await call("DELETE", `/api/projects/${pid}/scenes/${recentScene}`, undefined, user.token)],
  ["panel", await call("DELETE", `/api/panels/${panel}`, undefined, user.token)],
  ["asset", await call("DELETE", `/api/assets/${oldAsset}`, undefined, user.token)],
  ["asset2", await call("DELETE", `/api/assets/${recentAsset}`, undefined, user.token)],
  ["script", await call("DELETE", `/api/projects/${pid}/scripts/${script}`, undefined, user.token)],
]) check(`soft-delete ${what}`, res.status === 200, res);

// Age the "old" items past the retention window; leave the "recent" ones at 10 days.
const old = "now() - interval '31 days'", recent = "now() - interval '10 days'";
await db.query(`update scenes set deleted_at = ${old} where id = $1`, [sceneId]);
await db.query(`update scenes set deleted_at = ${recent} where id = $1`, [recentScene]);
await db.query(`update storyboard_panels set deleted_at = ${old} where id = $1`, [panel]);
await db.query(`update assets set deleted_at = ${old} where id = $1`, [oldAsset]);
await db.query(`update assets set deleted_at = ${recent} where id = $1`, [recentAsset]);
await db.query(`update scripts set deleted_at = ${old} where id = $1`, [script]);
// ...and an expired password-reset token.
await call("POST", "/api/auth/forgot-password", { email: `trash${u}@example.com` });
await db.query("update password_reset_tokens set expires_at = now() - interval '3 days' where user_id = $1", [user.user.id]);
const tokensBefore = await n("select count(*)::int n from password_reset_tokens where user_id = $1", [user.user.id]);
const dependentsBefore = {
  pins: await n("select count(*)::int n from panel_pins where panel_id = $1", [panel]),
  timeEntries: await n("select count(*)::int n from scene_time_entries where scene_id = $1", [sceneId]),
};
check("fixture has dependents to clean up", dependentsBefore.pins === 1 && dependentsBefore.timeEntries === 1 && tokensBefore === 1, { dependentsBefore, tokensBefore });

r = await call("POST", "/api/admin/maintenance", undefined, admin);
check("maintenance reports what it purged", r.status === 200 && r.json.scene >= 1 && r.json.panel >= 1 && r.json.asset >= 1 && r.json.script >= 1, r);

check("expired scene is gone", (await n("select count(*)::int n from scenes where id = $1", [sceneId])) === 0);
check("expired panel is gone, with its pins", (await n("select count(*)::int n from storyboard_panels where id = $1", [panel])) === 0 && (await n("select count(*)::int n from panel_pins where panel_id = $1", [panel])) === 0);
check("expired asset and script are gone", (await n("select count(*)::int n from assets where id = $1", [oldAsset])) === 0 && (await n("select count(*)::int n from scripts where id = $1", [script])) === 0);
check("the scene's time entries went with it", (await n("select count(*)::int n from scene_time_entries where scene_id = $1", [sceneId])) === 0);
check("panels in a purged scene survive, detached", (await db.query("select scene_id from storyboard_panels where id = $1", [keptPanel])).rows[0]?.scene_id === null);
check("recent trash (10 days) is kept", (await n("select count(*)::int n from scenes where id = $1", [recentScene])) === 1 && (await n("select count(*)::int n from assets where id = $1", [recentAsset])) === 1);
check("expired reset tokens are removed", (await n("select count(*)::int n from password_reset_tokens where user_id = $1", [user.user.id])) === 0);
r = await call("POST", "/api/admin/maintenance", undefined, admin);
check("running it again is a harmless no-op for these items", r.status === 200, r);

// "Delete forever" from the Trash page cleans up dependents too.
const sb2Panel = (await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: png }, user.token)).json.id;
await call("POST", `/api/panels/${sb2Panel}/pins`, { xPercent: 1, yPercent: 1, body: "p" }, user.token);
await call("DELETE", `/api/panels/${sb2Panel}`, undefined, user.token);
r = await call("DELETE", `/api/trash/permanent/panel/${sb2Panel}`, undefined, user.token);
check("delete forever succeeds", r.status === 200, r);
check("delete forever also removes pins", (await n("select count(*)::int n from panel_pins where panel_id = $1", [sb2Panel])) === 0 && (await n("select count(*)::int n from storyboard_panels where id = $1", [sb2Panel])) === 0);
r = await call("DELETE", `/api/trash/permanent/bogus/1`, undefined, user.token);
check("unknown trash kind rejected", r.status === 400, r);

await db.end();
process.exit(summary() ? 1 : 0);
