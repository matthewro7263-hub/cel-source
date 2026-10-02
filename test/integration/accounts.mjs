import { call, check, summary } from "./lib.mjs";

const u = Date.now();
let r = await call("POST", "/api/auth/signup", { email: `owner${u}@example.com`, name: "Owner", password: "password123" });
const token = r.json.token;
const pid = (await call("POST", "/api/projects", { title: "Accounts" }, token)).json.id;

// --- inviting an unknown email must not create an account with a guessable password
r = await call("POST", `/api/projects/${pid}/members`, { email: `Invitee${u}@Example.com` }, token);
check("invite creates the account", r.status === 200 && r.json.tempPassword, r);
const temp = r.json.tempPassword;
check("temp password is random, not a fixed string", temp !== "changeme" && temp.length >= 10, temp);
check("invited email is stored lowercased", r.json.user.email === `invitee${u}@example.com`, r.json.user);
r = await call("POST", "/api/auth/login", { email: `invitee${u}@example.com`, password: "changeme" });
check("the old fixed password does not work", r.status === 401, r);
r = await call("POST", "/api/auth/login", { email: `invitee${u}@example.com`, password: temp });
check("invitee can sign in with the temp password", r.status === 200, r);
const inviteeToken = r.json.token;

// --- change password
r = await call("POST", "/api/auth/password", { currentPassword: "wrong", newPassword: "a-new-password" }, inviteeToken);
check("wrong current password rejected", r.status === 403, r);
r = await call("POST", "/api/auth/password", { currentPassword: temp, newPassword: "short" }, inviteeToken);
check("weak new password rejected", r.status === 400, r);
r = await call("POST", "/api/auth/password", { currentPassword: temp, newPassword: "a-new-password" }, inviteeToken);
check("password changed, fresh token returned", r.status === 200 && r.json.token, r);
const fresh = r.json.token;
check("old session revoked after password change", (await call("GET", "/api/auth/me", undefined, inviteeToken)).status === 401);
check("fresh session works", (await call("GET", "/api/auth/me", undefined, fresh)).status === 200);
check("old password no longer works", (await call("POST", "/api/auth/login", { email: `invitee${u}@example.com`, password: temp })).status === 401);
check("new password works", (await call("POST", "/api/auth/login", { email: `invitee${u}@example.com`, password: "a-new-password" })).status === 200);

// --- discord webhook: only real Discord URLs (SSRF)
r = await call("PATCH", `/api/projects/${pid}`, { dltDiscordWebhookUrl: "http://169.254.169.254/latest/meta-data/" }, token);
check("internal URL rejected as webhook", r.status === 400, r);
r = await call("PATCH", `/api/projects/${pid}`, { dltDiscordWebhookUrl: "https://evil.example.com/api/webhooks/1/abc" }, token);
check("non-Discord host rejected as webhook", r.status === 400, r);
r = await call("PATCH", `/api/projects/${pid}`, { dltDiscordWebhookUrl: "https://discord.com/api/webhooks/1/abc" }, token);
check("real Discord webhook URL accepted", r.status === 200, r);
const stranger = (await call("POST", "/api/auth/signup", { email: `stranger${u}@example.com`, name: "S", password: "password123" })).json.token;
r = await call("POST", `/api/projects/${pid}/discord/test`, {}, stranger);
check("non-members can't fire the webhook test", r.status === 403, r);
r = await call("PATCH", `/api/projects/${pid}`, { dltDiscordWebhookUrl: null }, token);
check("webhook can be cleared", r.status === 200, r);

process.exit(summary() ? 1 : 0);
