// Account lifecycle: password reset, emailed invites, commission notifications, notification opt-out,
// project deletion without orphans, and account deletion. Email goes to the mock Resend server.
import pg from "pg";
import { call, check, summary, png, allMail, waitForMail, tokenFrom } from "./lib.mjs";

const u = Date.now();
const email = (n) => `${n}${u}@example.com`;
const signup = async (n) => (await call("POST", "/api/auth/signup", { email: email(n), name: n, password: "password123" })).json;
const login = (n, password) => call("POST", "/api/auth/login", { email: email(n), password });
const count = async (to, subject) => (await allMail()).filter((m) => m.to === to && subject.test(m.subject)).length;

// ---------------------------------------------------------------- forgot / reset password
const alice = await signup("alice");
const started = Date.now() - 1;
let r = await call("POST", "/api/auth/forgot-password", { email: email("nobody") });
check("forgot-password answers 200 for unknown emails (no account enumeration)", r.status === 200 && r.json.ok === true, r);
r = await call("POST", "/api/auth/forgot-password", { email: "not-an-email" });
check("forgot-password validates the address", r.status === 400, r);
r = await call("POST", "/api/auth/forgot-password", { email: email("alice").toUpperCase() });
check("forgot-password answers the same for real accounts (case-insensitive)", r.status === 200 && r.json.ok === true, r);
const resetMail = await waitForMail(email("alice"), /Reset your Cel password/, { after: started });
check("a reset email is sent to the account", !!resetMail, await allMail());
check("nothing is emailed to unknown addresses", (await count(email("nobody"), /./)) === 0);
const token = tokenFrom(resetMail);
check("the link points at the app's reset page", resetMail?.text.includes(`https://cel.test/#/reset-password?token=${token}`) && resetMail?.html.includes("reset-password?token="), resetMail?.text);
check("email is sent from the configured sender", resetMail?.from === "Cel <hello@cel.test>", resetMail?.from);
await call("POST", "/api/auth/forgot-password", { email: email("alice") });
await new Promise((r) => setTimeout(r, 400));
check("repeat requests within a minute don't send another email", (await count(email("alice"), /Reset your Cel password/)) === 1);

r = await call("POST", "/api/auth/reset-password", { token: "x".repeat(43), password: "brand-new-pass" });
check("unknown token rejected", r.status === 400 && /invalid or has expired/.test(r.json.message), r);
r = await call("POST", "/api/auth/reset-password", { token, password: "short" });
check("weak password rejected without burning the token", r.status === 400, r);
r = await call("POST", "/api/auth/reset-password", { token, password: "brand-new-pass" });
check("reset succeeds", r.status === 200 && r.json.ok === true, r);
check("old password stops working", (await login("alice", "password123")).status === 401);
check("new password works", (await login("alice", "brand-new-pass")).status === 200);
check("existing sessions are revoked by a reset", (await call("GET", "/api/auth/me", undefined, alice.token)).status === 401);
r = await call("POST", "/api/auth/reset-password", { token, password: "another-pass-123" });
check("a reset link works only once", r.status === 400, r);
check("a 'password changed' notice is emailed", !!(await waitForMail(email("alice"), /password was changed/, { after: started })));

// Changing the password from settings keeps working too (and emails a notice).
await new Promise((r) => setTimeout(r, 100));
const aliceToken = (await login("alice", "brand-new-pass")).json.token;
r = await call("POST", "/api/auth/password", { currentPassword: "brand-new-pass", newPassword: "changed-in-app" }, aliceToken);
check("changing the password in-app works", r.status === 200, r);

// ---------------------------------------------------------------- emailed invites
const owner = await signup("owner");
const pid = (await call("POST", "/api/projects", { title: "Invite <Test>" }, owner.token)).json.id;
r = await call("POST", `/api/projects/${pid}/members`, { email: email("newbie"), role: "reviewer" }, owner.token);
check("inviting a new person emails them and returns no password", r.status === 200 && r.json.emailed === true && !r.json.tempPassword, r);
const invite = await waitForMail(email("newbie"), /invited you/);
check("invite email names the inviter and project", !!invite && invite.subject.includes("owner") && invite.subject.includes("Invite <Test>"), invite?.subject);
check("invite email escapes the project title in HTML", !!invite && !invite.html.includes("<Test>") && invite.html.includes("&lt;Test&gt;"), invite?.html?.slice(0, 400));
const inviteToken = tokenFrom(invite);
check("new accounts get a set-password link", !!inviteToken, invite?.text);
check("the invitee can't sign in before choosing a password", (await login("newbie", "password123")).status === 401);
r = await call("POST", "/api/auth/reset-password", { token: inviteToken, password: "my-first-password" });
check("the invitee sets their password from the link", r.status === 200, r);
const newbie = (await login("newbie", "my-first-password")).json;
check("then signs in and sees the project as a reviewer", (await call("GET", `/api/projects/${pid}`, undefined, newbie.token)).status === 200);

r = await call("POST", `/api/projects/${pid}/members`, { email: email("alice"), role: "editor" }, owner.token);
check("inviting an existing user emails a project link, not a password link", r.status === 200 && r.json.emailed === true, r);
const existing = await waitForMail(email("alice"), /invited you/);
check("existing-user invite links to the project", !!existing && existing.text.includes(`#/projects/${pid}`) && !tokenFrom(existing), existing?.text);

r = await call("POST", `/api/projects/${pid}/members`, { email: `fail-${u}@example.com`, role: "editor" }, owner.token);
check("when email delivery fails the owner gets a temporary password instead", r.status === 200 && r.json.emailed === false && r.json.tempPassword?.length >= 10, r);

// ---------------------------------------------------------------- commission notifications + opt-out
const artistId = owner.user.id;
const submit = (name) => call("POST", "/api/commissions", { ownerUserId: artistId, clientName: name, clientEmail: "client@example.com", type: "Other", description: "Draw a <b>dog</b>", budgetRange: "Discuss" });
r = await submit("Client <i>One</i>");
check("commission accepted", r.status === 200, r);
const note = await waitForMail(email("owner"), /New commission request/);
check("the artist is emailed about a new request", !!note && note.text.includes("https://cel.test/#/commissions"), await allMail());
check("client-supplied text is escaped in the email HTML", !!note && !note.html.includes("<i>One</i>") && !note.html.includes("<b>dog</b>"), note?.html?.slice(0, 600));
check("the client's address gets no automatic reply", (await count("client@example.com", /./)) === 0);
r = await call("PATCH", "/api/auth/me", { emailNotifications: false }, owner.token);
check("notification preference is saved", r.status === 200 && r.json.emailNotifications === false, r);
check("preference is returned by /me", (await call("GET", "/api/auth/me", undefined, owner.token)).json.emailNotifications === false);
const before = await count(email("owner"), /New commission request/);
await submit("Second Client");
await new Promise((r) => setTimeout(r, 500));
check("opted-out artists get no commission email", (await count(email("owner"), /New commission request/)) === before);
check("security email still goes out when notifications are off", (await call("POST", "/api/auth/forgot-password", { email: email("owner") })).status === 200 && !!(await waitForMail(email("owner"), /Reset your Cel password/)));

// ---------------------------------------------------------------- project deletion leaves nothing behind
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;
const ownerRows = async (id) => ({
  assets: (await q("select count(*)::int n from assets where project_id=$1", [id]))[0].n,
  scenes: (await q("select count(*)::int n from scenes where project_id=$1", [id]))[0].n,
  storyboards: (await q("select count(*)::int n from storyboards where project_id=$1", [id]))[0].n,
  panels: (await q("select count(*)::int n from storyboard_panels where storyboard_id in (select id from storyboards where project_id=$1)", [id]))[0].n,
  aiKeys: (await q("select count(*)::int n from project_ai_keys where project_id=$1", [id]))[0].n,
  snapshots: (await q("select count(*)::int n from bak_snapshots where project_id=$1", [id]))[0].n,
  members: (await q("select count(*)::int n from project_members where project_id=$1", [id]))[0].n,
  chat: (await q("select count(*)::int n from ai_chat_sessions where project_id=$1", [id]))[0].n,
  inbox: (await q("select count(*)::int n from inbox_items where project_id=$1", [id]))[0].n,
});
const doomed = (await call("POST", "/api/projects", { title: "Doomed" }, owner.token)).json.id;
await call("POST", `/api/projects/${doomed}/assets`, { filename: "a.png", mimeType: "image/png", fileData: png, thumbnailData: png }, owner.token);
const doomedScene = (await call("POST", `/api/projects/${doomed}/scenes`, { title: "S", orderIdx: 0, status: "Todo" }, owner.token)).json.id;
const doomedBoard = (await call("POST", `/api/projects/${doomed}/storyboards`, { title: "B" }, owner.token)).json.id;
const doomedPanel = (await call("POST", `/api/storyboards/${doomedBoard}/panels`, { imageData: png, sceneId: doomedScene }, owner.token)).json.id;
await call("POST", `/api/panels/${doomedPanel}/pins`, { xPercent: 1, yPercent: 2, body: "pin" }, owner.token);
await call("POST", `/api/projects/${doomed}/ai/key`, { key: "sk-secret" }, owner.token);
await call("POST", `/api/projects/${doomed}/ai/sessions`, { title: "chat" }, owner.token);
await call("POST", `/api/projects/${doomed}/snapshot`, { label: "snap" }, owner.token);
const seeded = await ownerRows(doomed);
check("test project has data in every table before deletion", Object.entries(seeded).every(([table, n]) => table === "inbox" || n > 0), seeded);
const pinsBefore = (await q("select count(*)::int n from panel_pins where panel_id=$1", [doomedPanel]))[0].n;
check("panel pin exists before deletion", pinsBefore === 1, pinsBefore);
r = await call("DELETE", `/api/projects/${doomed}`, undefined, owner.token);
check("owner deletes the project", r.status === 200, r);
const after = await ownerRows(doomed);
check("deleting a project removes every row that belonged to it", Object.values(after).every((n) => n === 0), after);
check("…including rows two levels down (pins)", (await q("select count(*)::int n from panel_pins where panel_id=$1", [doomedPanel]))[0].n === 0);

// ---------------------------------------------------------------- account deletion
const leaver = await signup("leaver");
const leaverProject = (await call("POST", "/api/projects", { title: "Leaver's" }, leaver.token)).json.id;
await call("POST", `/api/projects/${leaverProject}/assets`, { filename: "x.png", mimeType: "image/png", fileData: png }, leaver.token);
await call("POST", `/api/projects/${leaverProject}/members`, { email: email("alice"), role: "editor" }, leaver.token);
await call("POST", `/api/projects/${pid}/members`, { email: email("leaver"), role: "editor" }, owner.token);
await call("POST", `/api/projects/${pid}/comments`, { body: "left a note" }, leaver.token);
await call("POST", "/api/commissions", { ownerUserId: leaver.user.id, clientName: "Cl", clientEmail: "cl@example.com", type: "Other", description: "d", budgetRange: "Discuss" });

r = await call("DELETE", "/api/auth/me", { password: "wrong", confirmEmail: email("leaver") }, leaver.token);
check("deleting an account needs the right password", r.status === 403, r);
r = await call("DELETE", "/api/auth/me", { password: "password123", confirmEmail: "someone@else.com" }, leaver.token);
check("…and the email typed to confirm", r.status === 400, r);
check("nothing was deleted by the failed attempts", (await call("GET", `/api/projects/${leaverProject}`, undefined, leaver.token)).status === 200);
r = await call("DELETE", "/api/auth/me", undefined, leaver.token);
check("deletion without a body is rejected", r.status === 400, r);
r = await call("DELETE", "/api/auth/me", { password: "password123", confirmEmail: email("leaver").toUpperCase() }, leaver.token);
check("account deletion succeeds", r.status === 200 && r.json.ok === true, r);
check("the old session no longer works", (await call("GET", "/api/auth/me", undefined, leaver.token)).status === 401);
check("the old credentials no longer work", (await login("leaver", "password123")).status === 401);
check("their owned project is gone", (await q("select count(*)::int n from projects where id=$1", [leaverProject]))[0].n === 0);
check("…along with everything inside it", Object.values(await ownerRows(leaverProject)).every((n) => n === 0));
check("their commissions (with client details) are gone", (await q("select count(*)::int n from commissions where owner_user_id=$1", [leaver.user.id]))[0].n === 0);
const row = (await q("select email, name, email_notifications from users where id=$1", [leaver.user.id]))[0];
check("the user row is anonymised, not left holding personal data", /^deleted-\d+-[0-9a-f]+@deleted\.invalid$/.test(row.email) && row.name === "Deleted user" && row.email_notifications === false, row);
check("their membership of other projects is removed", (await q("select count(*)::int n from project_members where user_id=$1", [leaver.user.id]))[0].n === 0);
check("other people's projects are untouched", (await call("GET", `/api/projects/${pid}`, undefined, owner.token)).status === 200);
const comments = (await call("GET", `/api/projects/${pid}/comments`, undefined, owner.token)).json.items ?? [];
const left = comments.find((c) => c.body === "left a note");
check("comments they left elsewhere remain, credited to 'Deleted user'", left?.author?.name === "Deleted user", comments);
r = await call("POST", "/api/commissions", { ownerUserId: leaver.user.id, clientName: "Cl", clientEmail: "cl@example.com", type: "Other", description: "d", budgetRange: "Discuss" });
check("a deleted artist's intake form stops accepting requests", r.status === 404, r);
r = await call("POST", "/api/auth/signup", { email: email("leaver"), name: "Again", password: "password123" });
check("the email address can be registered again", r.status === 200, r);
await db.end();

process.exit(summary() ? 1 : 0);
