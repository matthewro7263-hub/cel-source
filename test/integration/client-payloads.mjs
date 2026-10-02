// Payloads copied from the real client call sites (not hand-written API shapes): a server schema that
// rejects what the UI sends is invisible to type checks, e.g. lipsync/cues once required a projectId the UI never sends.
import { call, check, summary, png } from "./lib.mjs";
let r = await call("POST", "/api/auth/login", { email: "matthew@cel.app", password: "celdemo" });
const t = r.json.token; const uid = r.json.user.id;
const T = async (name, m, p, b, expect = "2xx") => { const x = await call(m, p, b, t); const ok = expect === "2xx" ? x.status < 300 : x.status === expect; check(name, ok, { status: x.status, body: x.json }); return x; };
const pid = 1;
const sceneId = (await call("GET", `/api/projects/${pid}/scenes`, undefined, t)).json[0].id;
const animatic = (await call("POST", `/api/projects/${pid}/animatics-v2`, { title: "x" }, t)).json;
// voice take (client sends projectId + audioData)
await T("voice take", "POST", "/api/aud/voice_takes", { projectId: pid, audioData: "data:audio/webm;base64,AAAA" });
await T("voice takes list", "GET", `/api/projects/${pid}/aud/voice_takes`);
// captions
r = await T("caption", "POST", `/api/animatics/${animatic.id}/aud/captions`, { text: "hello", startMs: 0, endMs: 1000 });
await T("captions list", "GET", `/api/animatics/${animatic.id}/aud/captions`);
// renders
r = await T("render", "POST", `/api/scenes/${sceneId}/renders`, { label: "R", status: "queued", software: "Blender", durationSeconds: null, fileUrl: "", notes: "" });
await T("renders list", "GET", `/api/scenes/${sceneId}/renders`);
await T("render patch", "PATCH", `/api/renders/${r.json.id}`, { status: "done" });
await T("render delete", "DELETE", `/api/renders/${r.json.id}`);
// quick capture
await T("inbox quick capture", "POST", "/api/inbox", { body: "idea", tags: "a,b" });
// lor casting toggle
await T("casting toggle", "POST", `/api/projects/${pid}/lor_casting/toggle`, { sceneId, entityId: 1, present: true });
await T("casting list", "GET", `/api/projects/${pid}/lor_casting`);
// asset revision
const asset = (await call("GET", `/api/projects/${pid}/assets`, undefined, t)).json.items[0];
r = await T("asset version", "POST", `/api/assets/${asset.id}/lor_versions`, { fileData: png });
await T("asset versions list", "GET", `/api/assets/${asset.id}/lor_versions`);
await T("approve version", "POST", `/api/assets/${asset.id}/lor_versions/${r.json.id}/approve`);
// scenes as UI sends
await T("scene create (ui payload)", "POST", `/api/projects/${pid}/scenes`, { number: "New", title: "t", description: "d" });
await T("scene create with status+deadline", "POST", `/api/projects/${pid}/scenes`, { number: "7", title: "t", status: "script", deadline: null });
// comments with scene/panel context (couch mode & review room)
const panels = (await call("GET", `/api/projects/${pid}/storyboards`, undefined, t)).json[0].panels;
await T("couch comment", "POST", `/api/projects/${pid}/comments`, { body: "x", panelId: panels[0].id });
await T("review comment", "POST", `/api/projects/${pid}/comments`, { body: "approved", sceneId });
// animatic editor patches
const tracks = (await call("GET", `/api/animatics-v2/${animatic.id}`, undefined, t)).json;
await T("animatic patch", "PATCH", `/api/animatics-v2/${animatic.id}`, { fps: 30, totalDurationMs: 9000 });
// storyboard sketch panel
await T("sketch panel", "POST", `/api/storyboards/${(await call("GET", `/api/projects/${pid}/storyboards`, undefined, t)).json[0].id}/panels`, { imageData: png, caption: "Sketch" });
// a11y patch partial
await T("a11y partial", "POST", "/api/a11y/prefs", { dyslexia: 1 });
// biz via UI payloads
await T("festival ui", "POST", "/api/biz/festivals", { name: "F", deadline: "2026-12-01", status: "planned", fee: 25, notes: null, projectId: null });
await T("expense ui", "POST", "/api/biz/expenses", { date: "2026-01-01", category: "software", amount: 10, notes: null, receiptUrl: null, projectId: null });
await T("contract ui", "POST", "/api/biz/contracts", { name: "C", kind: "nda", body: "x" });
await T("tax csv endpoint", "GET", "/api/biz/expenses");
// share-less misc
await T("achievements", "GET", "/api/achievements");
await T("inbox patch assign", "PATCH", `/api/inbox/${(await call("GET", "/api/inbox", undefined, t)).json[0].id}`, { projectId: pid });
process.exit(summary() ? 1 : 0);
