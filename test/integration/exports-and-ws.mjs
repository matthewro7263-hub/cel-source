import { createRequire } from "node:module";
import { call, check, summary, png, base } from "./lib.mjs";
// Node 20 has no global WebSocket; use the server's own `ws` dependency.
const WS = createRequire(import.meta.url)("ws");
let r = await call("POST", "/api/auth/login", { email: "matthew@cel.app", password: "celdemo" });
const token = r.json.token;
const pid = (await call("GET", "/api/projects", undefined, token)).json[0].id;
const wsBase = base.replace(/^http/, "ws");
const get = async (p) => { const res = await fetch(base + p, { headers: { authorization: "Bearer " + token } }); const b = Buffer.from(await res.arrayBuffer()); return { status: res.status, type: res.headers.get("content-type"), len: b.length, head: b.subarray(0, 8).toString("latin1"), text: b.length < 400 ? b.toString() : "" }; };
for (const kind of ["scenes-csv", "comments-csv", "storyboards-zip-png", "scripts-pdf", "credit-roll-png"]) {
  const x = await get(`/api/projects/${pid}/export/${kind}`);
  check("export " + kind, x.status === 200 && x.len > 20, x);
}
r = await get(`/api/projects/${pid}/archive`);
check("archive", r.status === 200 && r.head.startsWith("PK"), r); console.log("   archive", r.status, r.len);
// spritesheet
const sbs = (await call("GET", `/api/projects/${pid}/storyboards`, undefined, token)).json;
r = await call("POST", `/api/projects/${pid}/spritesheet`, { panelIds: sbs[0].panels.map(p => p.id), potPadding: true }, token);
check("spritesheet 200", r.status === 200, r);
// bak
r = await call("POST", `/api/projects/${pid}/snapshot`, { label: "t" }, token);
check("bak snapshot", r.status < 400, r);
r = await call("GET", `/api/trash`, undefined, token);
check("trash", r.status === 200, r);
r = await call("POST", `/api/scenes/1/gltf-stub`, {}, token);
check("gltf-stub not 5xx", r.status < 500, r);
// uploads
r = await call("POST", "/api/uploads/presign", { filename: "a.png", contentType: "image/png" }, token);
check("presign without R2 is a 503, not a 500", r.status === 503, r);
// review room ticket
r = await call("POST", `/api/projects/${pid}/review-room/ticket`, undefined, token);
check("ticket", r.status === 200 && r.json.ticket, r);
const ticket = r.json.ticket;
const ws1 = new WS(`${wsBase}/api/projects/${pid}/review-room?ticket=${ticket}`);
const opened = await new Promise((res) => { ws1.onopen = () => res(true); ws1.onerror = () => res(false); ws1.onclose = () => res(false); setTimeout(() => res(false), 3000); });
check("ws connects with ticket", opened);
ws1.close();
const ws2 = new WS(`${wsBase}/api/projects/${pid}/review-room?ticket=${ticket}`);
const reopened = await new Promise((res) => { ws2.onopen = () => res(true); ws2.onerror = () => res(false); ws2.onclose = () => res(false); setTimeout(() => res(false), 3000); });
check("ticket is single-use", !reopened);
const ws3 = new WS(`${wsBase}/api/projects/${pid}/review-room?token=${token}`);
const legacy = await new Promise((res) => { ws3.onopen = () => res(true); ws3.onerror = () => res(false); ws3.onclose = () => res(false); setTimeout(() => res(false), 3000); });
check("raw token no longer accepted on ws", !legacy);

// Relay: a peer receives cursor/stroke messages, the sender does not get its own echoed back.
const open = async () => {
  const t = (await call("POST", `/api/projects/${pid}/review-room/ticket`, undefined, token)).json.ticket;
  const ws = new WS(`${wsBase}/api/projects/${pid}/review-room?ticket=${t}`);
  const msgs = [];
  ws.onmessage = (e) => msgs.push(JSON.parse(e.data));
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; setTimeout(rej, 3000); });
  return { ws, msgs };
};
const a = await open(); const b = await open();
a.ws.send(JSON.stringify({ type: "cursor", x: 1, y: 2 }));
a.ws.send(JSON.stringify({ type: "note", body: "hello" }));
a.ws.send(JSON.stringify({ type: "bogus" }));
await new Promise((res) => setTimeout(res, 500));
check("peer receives cursor", b.msgs.some((m) => m.type === "cursor" && m.x === 1), b.msgs);
check("sender is not echoed its own cursor", !a.msgs.some((m) => m.type === "cursor"), a.msgs);
check("notes are echoed to the sender (no local apply)", a.msgs.some((m) => m.type === "note"), a.msgs);
check("unknown message types are dropped", !b.msgs.some((m) => m.type === "bogus"), b.msgs);
a.ws.close(); b.ws.close();

process.exit(summary() ? 1 : 0);
