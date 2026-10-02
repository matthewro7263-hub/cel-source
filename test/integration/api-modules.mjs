// Exercises every feature module's write paths as the real client uses them and fails on any 5xx
// or unexpected 4xx. Authorization expectations (403/404) are asserted explicitly.
import { call, check, summary, png } from "./lib.mjs";

let r = await call("POST", "/api/auth/login", { email: "matthew@cel.app", password: "celdemo" });
const token = r.json.token; const uid = r.json.user.id;
const uniq = Date.now();
r = await call("POST", "/api/auth/signup", { email: `o${uniq}@example.com`, name: "Other", password: "password123" });
const otherToken = r.json.token;
const pid = (await call("GET", "/api/projects", undefined, token)).json[0].id;
const sceneId = (await call("GET", `/api/projects/${pid}/scenes`, undefined, token)).json[0]?.id;
const storyboards = (await call("GET", `/api/projects/${pid}/storyboards`, undefined, token)).json;

/** T(name, method, path, body, { as, expect }) — expect defaults to any 2xx. */
const T = async (name, method, path, body, { as = token, expect = "2xx" } = {}) => {
  const res = await call(method, path, body, as);
  const ok = expect === "2xx" ? res.status >= 200 && res.status < 300 : res.status === expect;
  check(name, ok, { status: res.status, body: res.json });
  return res;
};

// commissions (public intake with a 3MB reference image exercises the per-route body limit)
r = await T("public commission intake", "POST", "/api/commissions", {
  ownerUserId: uid, clientName: "Cli", clientEmail: "c@x.com", type: "Storyboard", description: "desc",
  budgetRange: "Discuss", referenceImage: "data:image/png;base64," + "A".repeat(3 * 1024 * 1024),
}, { as: undefined });
const cid = r.json.id;
await T("list commissions", "GET", "/api/commissions");
r = await T("line item", "POST", `/api/commissions/${cid}/line-items`, { description: "x", quantity: 2, unitPriceCents: 500 });
await T("patch line item", "PATCH", `/api/commission-line-items/${r.json.id}`, { quantity: 3 });
await T("quote", "PATCH", `/api/commissions/${cid}/quote`, { quoteCents: 1500 });
r = await T("log fractional hours", "POST", `/api/commissions/${cid}/hours`, { hours: 2.5 });
await T("convert to project", "POST", `/api/commissions/${cid}/convert`, {});
await T("patch commission", "PATCH", `/api/commissions/${cid}`, { status: "accepted" });
await T("other user cannot read commission", "GET", `/api/commissions/${cid}`, undefined, { as: otherToken, expect: 403 });
await T("pricing preset", "POST", `/api/projects/${pid}/pricing-presets`, { name: "p", priceCents: 100 });

// ai sessions + IDOR
await T("ai key set", "POST", `/api/projects/${pid}/ai/key`, { key: "sk-test", model: "m" });
r = await T("ai session", "POST", `/api/projects/${pid}/ai/sessions`, { title: "t" });
const sess = r.json.id;
r = await call("POST", "/api/projects", { title: "Other proj" }, otherToken);
const opid = r.json.id;
await T("ai messages IDOR", "GET", `/api/projects/${opid}/ai/sessions/${sess}/messages`, undefined, { as: otherToken, expect: 404 });
await T("ai session delete IDOR", "DELETE", `/api/projects/${opid}/ai/sessions/${sess}`, undefined, { as: otherToken, expect: 404 });
await T("ai agent check non-member", "POST", `/api/projects/${pid}/ai/agent/check`, { scriptContent: "x" }, { as: otherToken, expect: 403 });
await T("ai key delete", "DELETE", `/api/projects/${pid}/ai/key`);

// nested resources must be scoped to the project in the URL
const scriptRes = await call("POST", `/api/projects/${opid}/scripts`, { title: "mine", content: "x" }, otherToken);
await T("cannot edit another project's script via own project", "PATCH", `/api/projects/${pid}/scripts/${scriptRes.json.id}`, { content: "pwn" }, { expect: 404 });
await T("cannot delete another project's script", "DELETE", `/api/projects/${pid}/scripts/${scriptRes.json.id}`, undefined, { expect: 404 });

// inbox / tags / search / achievements
await T("inbox create", "POST", "/api/inbox", { kind: "note", title: "n", body: "b" });
await T("inbox list", "GET", "/api/inbox");
r = await T("tag create", "POST", "/api/tags", { name: "tg", color: "#fff" });
await T("tag assign", "POST", "/api/tag-assignments", { tagId: r.json.id, entityKind: "scene", entityId: sceneId });
r = await call("GET", `/api/tag-assignments?kind=scene&entityId=${sceneId}`, undefined, otherToken);
check("tag assignments don't leak to other users", r.status === 200 && r.json.length === 0, r);
await T("search", "GET", "/api/search?q=bingo");
await T("achievements", "GET", "/api/achievements");

// timers (epoch ms overflowed int4)
await T("timer start", "POST", `/api/scenes/${sceneId}/timer/start`, {});
await T("timer stop", "POST", `/api/scenes/${sceneId}/timer/stop`, {});
await T("scene timers", "GET", `/api/projects/${pid}/scene-timers`);

// challenges (+ admin gate)
await T("create prompt as non-admin", "POST", "/api/challenges/prompts", { weekNumber: 41, title: "t", body: "b" }, { as: otherToken, expect: 403 });
await T("create prompt as admin", "POST", "/api/challenges/prompts", { weekNumber: 41, title: "t", body: "b" });
r = await T("prompts", "GET", "/api/challenges/prompts");
r = await T("submission", "POST", "/api/challenges/submissions", { promptId: r.json[0].id, notes: "c" });
await T("react", "POST", `/api/challenges/submissions/${r.json.id}/reactions`, { sticker: "spark" });
await T("feed", "GET", "/api/challenges/feed");
await T("snapshot as non-admin", "POST", "/api/challenges/leaderboard/snapshot", { week: 1 }, { as: otherToken, expect: 403 });
await T("snapshot as admin", "POST", "/api/challenges/leaderboard/snapshot", { week: 1 });

// business / a11y
await T("festival", "POST", "/api/biz/festivals", { name: "F", status: "planned" });
await T("contracts (auto-seed)", "GET", "/api/biz/contracts");
await T("expense", "POST", "/api/biz/expenses", { amount: 12.5, notes: "e", category: "software", date: "2026-01-01" });
await T("a11y set", "POST", "/api/a11y/prefs", { focusMode: 1 });
await T("a11y get", "GET", "/api/a11y/prefs");

// studio
await T("render event", "POST", `/api/projects/${pid}/studio/render-events`, { label: "render", minutes: 5, notes: "n" });
await T("render budget", "PUT", `/api/projects/${pid}/studio/render-budget`, { totalMinutes: 100 });
await T("credits", "POST", `/api/projects/${pid}/studio/credits`, { section: "cast", name: "N", role: "R", orderIdx: 0 });
r = await T("studio snapshot", "POST", `/api/projects/${pid}/studio/snapshots`, { label: "s" });
await T("studio snapshot restore", "POST", `/api/projects/${pid}/studio/snapshots/${r.json.id}/restore`, {});

// approvals / feedback (client sends no projectId / signedAt) / lore / audio2 / mcp
await T("approvals", "GET", `/api/projects/${pid}/approvals`);
await T("cli approval", "POST", `/api/projects/${pid}/cli_approvals`, { phase: "storyboard", signedName: "N", signatureData: png, signedAt: new Date().toISOString() });
await T("cli feedback", "POST", `/api/projects/${pid}/cli_feedback`, { sceneId, fields: JSON.stringify({ a: 1 }) });
await T("lor fact", "POST", `/api/projects/${pid}/lor_facts`, { category: "character", title: "t", body: "b" });
await T("lor fact requires title", "POST", `/api/projects/${pid}/lor_facts`, { body: "b" }, { expect: 400 });
await T("lor palette", "POST", `/api/projects/${pid}/lor_palettes`, { name: "p", colors: ["#fff"] });
await T("lor seed bible", "POST", `/api/projects/${pid}/lor_seed_bible`, {});
await T("lor check", "POST", `/api/projects/${pid}/lor_check_script`, { scriptContent: "Bingo walks. Bluey runs." });
await T("lipsync (no projectId in body)", "POST", `/api/projects/${pid}/lipsync`, { transcript: "hi there", timelineJson: "[]" });
await T("cue (no projectId in body)", "POST", `/api/projects/${pid}/cues`, { label: "l", timestampMs: 100 });
await T("mcp list_shots", "POST", "/api/mcp/list_shots", { projectId: pid });
await T("mcp list_shots forbidden", "POST", "/api/mcp/list_shots", { projectId: pid }, { as: otherToken, expect: 403 });
await T("mcp add_comment", "POST", "/api/mcp/add_comment", { projectId: pid, entityType: "scene", entityId: sceneId, body: "hi" });
await T("mcp list_assets", "POST", "/api/mcp/list_assets", { projectId: pid });

// editor animatics
r = await T("animatic v2", "POST", `/api/projects/${pid}/animatics-v2`, { title: "v2" });
r = await T("track", "POST", `/api/animatics-v2/${r.json.id}/tracks`, { kind: "video", name: "V1" });
await T("clip", "POST", `/api/tracks/${r.json.id}/clips`, { startMs: 0, durationMs: 1000, panelId: null });
const firstPanel = storyboards[0].panels[0].id;
await T("pin", "POST", `/api/panels/${firstPanel}/pins`, { xPercent: 50, yPercent: 50, body: "pin" });

// r2 keys must belong to the caller
await T("panel with foreign r2 key rejected", "POST", `/api/storyboards/${storyboards[0].id}/panels`, { r2Key: "uploads/999999/secret.png" }, { expect: 403 });
await T("asset with foreign r2 key rejected", "POST", `/api/projects/${pid}/assets`, { filename: "a", r2Key: "uploads/999999/secret.png" }, { expect: 403 });

process.exit(summary() ? 1 : 0);
