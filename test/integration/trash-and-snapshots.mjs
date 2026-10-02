import { call, check, summary, png } from "./lib.mjs";

const u = Date.now();
let r = await call("POST", "/api/auth/signup", { email: `trash${u}@example.com`, name: "Trash", password: "password123" });
const token = r.json.token;
const pid = (await call("POST", "/api/projects", { title: "Trash test" }, token)).json.id;
const sceneId = (await call("POST", `/api/projects/${pid}/scenes`, { number: "1A", title: "Scene" }, token)).json.id;
const scriptId = (await call("POST", `/api/projects/${pid}/scripts`, { title: "S", content: "keep me" }, token)).json.id;
const sbId = (await call("POST", `/api/projects/${pid}/storyboards`, { title: "B" }, token)).json.id;
const panelId = (await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: png, caption: "p" }, token)).json.id;
const assetId = (await call("POST", `/api/projects/${pid}/assets`, { filename: "a.png", mimeType: "image/png", fileData: png }, token)).json.id;

// deleting moves to trash instead of destroying
await call("DELETE", `/api/projects/${pid}/scenes/${sceneId}`, undefined, token);
await call("DELETE", `/api/projects/${pid}/scripts/${scriptId}`, undefined, token);
await call("DELETE", `/api/panels/${panelId}`, undefined, token);
await call("DELETE", `/api/assets/${assetId}`, undefined, token);
check("scene gone from list", (await call("GET", `/api/projects/${pid}/scenes`, undefined, token)).json.length === 0);
check("script gone from list", (await call("GET", `/api/projects/${pid}/scripts`, undefined, token)).json.length === 0);
check("panel gone from storyboard", (await call("GET", `/api/projects/${pid}/storyboards`, undefined, token)).json[0].panels.length === 0);
check("asset gone from list", (await call("GET", `/api/projects/${pid}/assets`, undefined, token)).json.items.length === 0);

r = await call("GET", `/api/projects/${pid}/trash`, undefined, token);
check("all four land in trash", r.json.scenes.length === 1 && r.json.scripts.length === 1 && r.json.panels.length === 1 && r.json.assets.length === 1, r.json);

// restore brings them back
for (const [kind, id] of [["scene", sceneId], ["script", scriptId], ["panel", panelId], ["asset", assetId]]) {
  const res = await call("POST", `/api/trash/restore/${kind}/${id}`, undefined, token);
  check(`restore ${kind}`, res.status === 200, res);
}
check("restored scene is listed again", (await call("GET", `/api/projects/${pid}/scenes`, undefined, token)).json.length === 1);
check("restored script keeps its content", (await call("GET", `/api/projects/${pid}/scripts`, undefined, token)).json[0]?.content === "keep me");
check("restored panel is back", (await call("GET", `/api/projects/${pid}/storyboards`, undefined, token)).json[0].panels.length === 1);

// permanent delete really removes
await call("DELETE", `/api/projects/${pid}/scenes/${sceneId}`, undefined, token);
r = await call("DELETE", `/api/trash/permanent/scene/${sceneId}`, undefined, token);
check("permanent delete", r.status === 200, r);
check("trash is empty of scenes after permanent delete", (await call("GET", `/api/projects/${pid}/trash`, undefined, token)).json.scenes.length === 0);

// panel numbering survives deletes (no duplicate orderIdx)
const p2 = (await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: png }, token)).json;
const p3 = (await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: png }, token)).json;
check("new panels get distinct increasing order", p3.orderIdx > p2.orderIdx, [p2.orderIdx, p3.orderIdx]);

// branching snapshot -> destructive change -> restore
r = await call("POST", `/api/projects/${pid}/snapshot`, { label: "before" }, token);
check("create snapshot", r.status === 200, r);
const snaps = await call("GET", `/api/projects/${pid}/snapshots`, undefined, token);
const snapId = snaps.json[0].id;
await call("DELETE", `/api/projects/${pid}/scripts/${scriptId}`, undefined, token);
await call("POST", `/api/projects/${pid}/scenes`, { number: "9Z", title: "added after snapshot" }, token);
r = await call("POST", `/api/projects/${pid}/snapshots/${snapId}/restore`, {}, token);
check("restore snapshot", r.status === 200, r);
const scenesAfter = (await call("GET", `/api/projects/${pid}/scenes`, undefined, token)).json;
check("snapshot restore removed scene added after it", !scenesAfter.some((s) => s.number === "9Z"), scenesAfter);

const after = (await call("GET", `/api/projects/${pid}/snapshots`, undefined, token)).json;
check("restore keeps an auto-backup so it can be undone", after.some((x) => /Auto-backup/.test(x.label)), after);
check("restored script came back with its content", (await call("GET", `/api/projects/${pid}/scripts`, undefined, token)).json.some((x) => x.content === "keep me"));
// undo the restore using the auto-backup
const backup = after.find((x) => /Auto-backup/.test(x.label));
r = await call("POST", `/api/projects/${pid}/snapshots/${backup.id}/restore`, {}, token);
check("restoring the auto-backup works (undo)", r.status === 200, r);
check("undo brought the post-snapshot scene back", (await call("GET", `/api/projects/${pid}/scenes`, undefined, token)).json.some((x) => x.number === "9Z"));

process.exit(summary() ? 1 : 0);
