// owner / editor / reviewer: reviewers can read and take part in review, but not change production content.
import { call, check, summary, png } from "./lib.mjs";

const u = Date.now();
const signup = async (n) => (await call("POST", "/api/auth/signup", { email: `${n}${u}@example.com`, name: n, password: "password123" })).json;
const owner = (await signup("owner")).token;
const pid = (await call("POST", "/api/projects", { title: "Roles" }, owner)).json.id;
const sceneId = (await call("POST", `/api/projects/${pid}/scenes`, { number: "1A", title: "S" }, owner)).json.id;
const sbId = (await call("POST", `/api/projects/${pid}/storyboards`, { title: "B" }, owner)).json.id;
const panelId = (await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: png }, owner)).json.id;
const approvals = (await call("GET", `/api/projects/${pid}/approvals`, undefined, owner)).json;

let r = await call("POST", `/api/projects/${pid}/members`, { email: `reviewer${u}@example.com`, role: "reviewer" }, owner);
const reviewerEmail = r.json.user.email; const reviewerId = r.json.user.id;
const reviewer = (await call("POST", "/api/auth/login", { email: reviewerEmail, password: r.json.tempPassword })).json.token;
check("invite rejects unknown roles", (await call("POST", `/api/projects/${pid}/members`, { email: `x${u}@example.com`, role: "admin" }, owner)).status === 400);

// can read & take part in review
check("reviewer can read the project", (await call("GET", `/api/projects/${pid}`, undefined, reviewer)).status === 200);
check("reviewer can read storyboards", (await call("GET", `/api/projects/${pid}/storyboards`, undefined, reviewer)).status === 200);
check("reviewer can comment", (await call("POST", `/api/projects/${pid}/comments`, { body: "looks good" }, reviewer)).status === 200);
check("reviewer can pin a panel", (await call("POST", `/api/panels/${panelId}/pins`, { xPercent: 10, yPercent: 20, body: "here" }, reviewer)).status === 200);
check("reviewer can sign off a milestone", (await call("PUT", `/api/approvals/${approvals[0].id}`, { status: "approved", signature: "Rev" }, reviewer)).status === 200);
check("reviewer can get a review-room ticket", (await call("POST", `/api/projects/${pid}/review-room/ticket`, undefined, reviewer)).status === 200);
check("reviewer can export a spritesheet (read-only output)", [200, 400].includes((await call("POST", `/api/projects/${pid}/spritesheet`, { panelIds: [panelId] }, reviewer)).status));

// cannot change production content
const denied = async (name, m, p, b) => check(`reviewer cannot ${name}`, (await call(m, p, b, reviewer)).status === 403);
await denied("create a scene", "POST", `/api/projects/${pid}/scenes`, { number: "2", title: "x" });
await denied("edit a scene", "PATCH", `/api/projects/${pid}/scenes/${sceneId}`, { title: "hacked" });
await denied("delete a scene", "DELETE", `/api/projects/${pid}/scenes/${sceneId}`);
await denied("upload a panel", "POST", `/api/storyboards/${sbId}/panels`, { imageData: png });
await denied("edit a panel", "PATCH", `/api/panels/${panelId}`, { caption: "x" });
await denied("delete a panel", "DELETE", `/api/panels/${panelId}`);
await denied("create a script", "POST", `/api/projects/${pid}/scripts`, { title: "s", content: "c" });
await denied("upload an asset", "POST", `/api/projects/${pid}/assets`, { filename: "a", fileData: png });
await denied("edit project details", "PATCH", `/api/projects/${pid}`, { title: "hacked" });
await denied("start a scene timer", "POST", `/api/scenes/${sceneId}/timer/start`, {});
await denied("restore a snapshot", "POST", `/api/projects/${pid}/snapshots/1/restore`, {});
await denied("invite people", "POST", `/api/projects/${pid}/members`, { email: `y${u}@example.com` });
await denied("change roles", "PATCH", `/api/projects/${pid}/members/${reviewerId}`, { role: "editor" });
check("content untouched after all those attempts", (await call("GET", `/api/projects/${pid}/scenes`, undefined, owner)).json[0].title === "S");

// owner promotes the reviewer; permissions change immediately (access cache invalidated)
r = await call("PATCH", `/api/projects/${pid}/members/${reviewerId}`, { role: "editor" }, owner);
check("owner can change a member's role", r.status === 200, r);
check("promoted member can now edit", (await call("POST", `/api/projects/${pid}/scenes`, { number: "2", title: "x" }, reviewer)).status === 200);
r = await call("PATCH", `/api/projects/${pid}/members/${reviewerId}`, { role: "reviewer" }, owner);
check("and demote again", (await call("POST", `/api/projects/${pid}/scenes`, { number: "3", title: "y" }, reviewer)).status === 403);

process.exit(summary() ? 1 : 0);
