import { call, check, summary, png } from "./lib.mjs";
const uniq = Date.now();
// --- auth
let r = await call("POST", "/api/auth/signup", { email: `Test${uniq}@Example.com`, name: "Tester", password: "password123" });
check("signup 200", r.status === 200, r);
const token = r.json.token; const me = r.json.user;
check("signup lowercases email", me.email === `test${uniq}@example.com`, me);
check("signup hides hash", !("passwordHash" in me), me);
r = await call("POST", "/api/auth/signup", { email: `TEST${uniq}@example.com`, name: "Dup", password: "password123" });
check("dup signup (case) rejected", r.status === 400, r);
r = await call("POST", "/api/auth/signup", { email: "bad", name: "", password: "x" });
check("invalid signup -> 400", r.status === 400, r);
r = await call("POST", "/api/auth/login", { email: `TEST${uniq}@EXAMPLE.com`, password: "password123" });
check("login case-insensitive", r.status === 200, r);
r = await call("POST", "/api/auth/login", { email: `test${uniq}@example.com`, password: "wrong" });
check("bad password 401", r.status === 401, r);
r = await call("GET", "/api/auth/me", undefined, token);
check("me 200", r.status === 200 && r.json.email === me.email, r);
r = await call("GET", "/api/auth/me");
check("me unauth 401", r.status === 401, r);
r = await call("PATCH", "/api/auth/me", { name: "Renamed" }, token);
check("patch me", r.status === 200 && r.json.name === "Renamed" && !r.json.passwordHash, r);
// --- projects
r = await call("POST", "/api/projects", { title: "Flow Project", description: "d", deadline: "2026-12-31" }, token);
check("create project", r.status === 200 || r.status === 201, r);
const pid = r.json.id;
r = await call("GET", `/api/projects/${pid}`, undefined, token);
check("get project", r.status === 200 && r.json.project?.title === "Flow Project", r);
r = await call("PATCH", `/api/projects/${pid}`, { status: "In production" }, token);
check("patch project", r.status === 200, r);
r = await call("GET", "/api/projects/abc", undefined, token);
check("non-numeric id 400", r.status === 400, r);
// other user cannot see
r = await call("POST", "/api/auth/signup", { email: `other${uniq}@example.com`, name: "Other", password: "password123" });
const otherToken = r.json.token;
r = await call("GET", `/api/projects/${pid}`, undefined, otherToken);
check("other user 403 on project", r.status === 403, r);
// --- scripts
r = await call("POST", `/api/projects/${pid}/scripts`, { title: "S1", content: "# Hello" }, token);
check("create script", r.status < 300, r); const scriptId = r.json.id;
r = await call("PATCH", `/api/projects/${pid}/scripts/${scriptId}`, { content: "# Hello 2" }, token);
check("patch script", r.status === 200, r);
r = await call("GET", `/api/projects/${pid}/scripts`, undefined, token);
check("list scripts", r.status === 200 && r.json.length === 1, r);
// --- scenes
r = await call("POST", `/api/projects/${pid}/scenes`, { title: "Scene 1", orderIdx: 0, status: "Todo" }, token);
check("create scene", r.status < 300, r); const sceneId = r.json?.id;
r = await call("PATCH", `/api/projects/${pid}/scenes/${sceneId}`, { status: "In progress" }, token);
check("patch scene", r.status === 200, r);
// --- storyboards & panels
r = await call("POST", `/api/projects/${pid}/storyboards`, { title: "Board 1" }, token);
check("create storyboard", r.status < 300, r); const sbId = r.json.id;
r = await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: png, caption: "p1", orderIdx: 0 }, token);
check("create panel", r.status < 300, r); const p1 = r.json?.id;
r = await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: png, caption: "p2", orderIdx: 1 }, token);
const p2 = r.json?.id;
const big = "data:image/png;base64," + "A".repeat(5 * 1024 * 1024);
r = await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: big, caption: "big", orderIdx: 2 }, token);
check("5MB panel accepted (body limit)", r.status < 300, { status: r.status, j: JSON.stringify(r.json).slice(0, 100) });
const p3 = r.json?.id;
r = await call("POST", `/api/storyboards/${sbId}/panels/bulk`, { panels: [{ imageData: png, caption: "b1" }, { imageData: png, caption: "b2" }] }, token);
check("bulk panels", r.status < 300, r);
r = await call("GET", `/api/projects/${pid}/storyboards`, undefined, token);
check("list storyboards", r.status === 200, r);
r = await call("POST", `/api/storyboards/${sbId}/panels/reorder`, { orderedIds: [p2, p1] }, token);
check("reorder partial rejected", r.status === 400, r);
r = await call("GET", `/api/projects/${pid}/storyboards`, undefined, token);
const allIds = (r.json[0].panels ?? []).map(p => p.id);
r = await call("POST", `/api/storyboards/${sbId}/panels/reorder`, { orderedIds: [...allIds].reverse() }, token);
check("reorder full ok", r.status === 200, r);
r = await call("PATCH", `/api/panels/${p1}`, { caption: "edited" }, token);
check("patch panel", r.status === 200, r);
r = await call("DELETE", `/api/panels/${p3}`, undefined, token);
check("delete panel", r.status < 300, r);
r = await call("PATCH", `/api/panels/${p1}`, { caption: "x" }, otherToken);
check("other user cannot patch panel", r.status === 403, r);
// --- comments
r = await call("POST", `/api/projects/${pid}/comments`, { body: "hello", sceneId }, token);
check("create comment", r.status < 300, r); const cid = r.json?.id;
r = await call("GET", `/api/projects/${pid}/comments`, undefined, token);
check("list comments", r.status === 200 && r.json.items?.length >= 1, r);
// --- assets
r = await call("POST", `/api/projects/${pid}/assets`, { filename: "a.png", mimeType: "image/png", type: "image", fileData: png, size: 100 }, token);
check("create asset", r.status < 300, r);
const aid = r.json?.id;
r = await call("GET", `/api/projects/${pid}/assets`, undefined, token);
check("list assets", r.status === 200, r);
r = await call("GET", `/api/assets/${aid}/download`, undefined, token);
check("asset download", r.status === 200 || r.status === 404, r);
// --- animatics
const vid = "data:video/mp4;base64," + "AAAA".repeat(1024);
r = await call("POST", `/api/projects/${pid}/animatics`, { title: "A1", videoData: vid }, token);
check("create animatic", r.status < 300, r);
// --- share
r = await call("PATCH", `/api/projects/${pid}`, { shareEnabled: true }, token);
const shareToken = r.json?.shareToken;
check("share enabled + token", r.status === 200 && !!shareToken, r);
r = await call("GET", `/api/share/${shareToken}`);
check("public share", r.status === 200 && r.json.storyboards, r);
check("share hides token", r.json?.project?.shareToken === undefined, r.json?.project);
r = await call("GET", `/api/share/${shareToken}/meta`);
check("share meta", r.status === 200, r);
// --- members
r = await call("POST", `/api/projects/${pid}/members`, { email: `other${uniq}@example.com`, role: "reviewer" }, token);
check("add member", r.status < 300, r);
r = await call("GET", `/api/projects/${pid}`, undefined, otherToken);
check("member can see project", r.status === 200, r);
r = await call("DELETE", `/api/projects/${pid}/members/${(await call("GET","/api/auth/me",undefined,otherToken)).json.id}`, undefined, token);
check("remove member", r.status < 300, r);
r = await call("GET", `/api/projects/${pid}`, undefined, otherToken);
check("removed member loses access immediately", r.status === 403, r);
// --- logout-all revocation
r = await call("POST", "/api/auth/logout-all", undefined, otherToken);
check("logout-all", r.status === 200, r);
r = await call("GET", "/api/auth/me", undefined, otherToken);
check("revoked token rejected", r.status === 401, r);
// --- cleanup
r = await call("DELETE", `/api/projects/${pid}`, undefined, token);
check("delete project", r.status < 300, r);
// --- static hosting / routing behaviour
{
  const { base } = await import("./lib.mjs");
  let res = await fetch(base + "/api/definitely-not-a-route");
  check("unknown API route is a JSON 404", res.status === 404 && /json/.test(res.headers.get("content-type") || ""), res.status);
  res = await fetch(base + "/assets/missing-chunk-abc123.js");
  check("missing static file is a 404, not index.html", res.status === 404, res.status);
  res = await fetch(base + "/some/spa/route");
  check("SPA routes fall back to index.html", res.status === 200 && /<div id="root"/.test(await res.text()));
  check("index.html is revalidated", res.headers.get("cache-control") === "no-cache", res.headers.get("cache-control"));
  const html = await (await fetch(base + "/")).text();
  const asset = html.match(/\/?assets\/[\w.-]+\.js/)?.[0];
  if (asset) {
    res = await fetch(base + "/" + asset.replace(/^\//, ""));
    check("fingerprinted assets are immutable", /immutable/.test(res.headers.get("cache-control") || ""), res.headers.get("cache-control"));
  }
  res = await fetch(base + "/health");
  check("security headers present", res.headers.get("x-content-type-options") === "nosniff" && !res.headers.get("x-powered-by"), [...res.headers.keys()]);
}

process.exit(summary() ? 1 : 0);
