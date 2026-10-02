import { call, check, summary, png } from "./lib.mjs";

const u = Date.now();
let r = await call("POST", "/api/auth/signup", { email: `share${u}@example.com`, name: "Sharer", password: "password123" });
const token = r.json.token;
r = await call("POST", "/api/projects", { title: "Shared" }, token);
const pid = r.json.id;
await call("POST", `/api/projects/${pid}/scripts`, { title: "S", content: "# Visible to reviewers" }, token);
r = await call("POST", `/api/projects/${pid}/storyboards`, { title: "B" }, token);
await call("POST", `/api/storyboards/${r.json.id}/panels`, { imageData: png, caption: "p" }, token);
r = await call("PATCH", `/api/projects/${pid}`, { shareEnabled: true }, token);
const share = r.json.shareToken;

r = await call("GET", `/api/share/${share}`);
check("public share loads", r.status === 200, r);
check("shared script has its content", r.json.scripts?.[0]?.content === "# Visible to reviewers", r.json.scripts);
check("share payload never exposes the share token", r.json.project?.shareToken === undefined);

r = await call("GET", `/api/projects/${pid}/cli_approvals?token=${share}`);
check("anonymous reviewer can read approvals with the share token", r.status === 200, r);
r = await call("POST", `/api/projects/${pid}/cli_approvals?token=${share}`, { phase: "storyboard", signedName: "Client", signatureData: "Client" });
check("anonymous reviewer can sign off with the share token", r.status === 200, r);
r = await call("POST", `/api/projects/${pid}/cli_feedback?token=${share}`, { fields: "{}" });
check("anonymous reviewer can leave feedback", r.status === 200, r);
r = await call("POST", `/api/projects/${pid}/cli_approvals`, { phase: "x", signedName: "n", signatureData: "n" });
check("no token and no session is rejected", r.status === 401, r);
r = await call("POST", `/api/projects/${pid}/cli_approvals?token=wrong`, { phase: "x", signedName: "n", signatureData: "n" });
check("wrong token is rejected", r.status === 403, r);

await call("PATCH", `/api/projects/${pid}`, { shareEnabled: false }, token);
r = await call("GET", `/api/share/${share}`);
check("disabling sharing revokes the link", r.status === 404, r);

process.exit(summary() ? 1 : 0);
