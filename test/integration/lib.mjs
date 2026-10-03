// The runner sets BASE; defaults match a local `pnpm dev` on PORT=5055.
export const base = process.env.BASE || "http://127.0.0.1:5055";
export async function call(method, path, body, token, extra = {}) {
  const headers = { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: "Bearer " + token } : {}), ...extra };
  const res = await fetch(base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, headers: res.headers };
}
let fails = 0, passes = 0;
export function check(name, cond, detail) {
  if (cond) { passes++; } else { fails++; console.log("FAIL:", name, detail !== undefined ? JSON.stringify(detail).slice(0, 300) : ""); }
}
export function summary() { console.log(`\n${passes} passed, ${fails} failed`); return fails; }
export const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** The seeded demo project ("Bluey Fan Animation"); never rely on its position in /api/projects. */
export async function demoProjectId(token) {
  const projects = (await call("GET", "/api/projects", undefined, token)).json;
  const demo = projects.find((p) => /^Bluey Fan Animation/.test(p.title));
  if (!demo) throw new Error("demo project not found; was the database seeded?");
  return demo.id;
}

// ---- captured email (mock Resend; see mock-resend.mjs) ----
const mailBase = process.env.MAIL_BASE;
export async function allMail() { return (await fetch(`${mailBase}/__sent`)).json(); }
/** Waits (mail is sent in the background) for a message to `to` whose subject matches. */
export async function waitForMail(to, subject, { timeoutMs = 4000, after = 0 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hit = (await allMail()).filter((m) => m.to === to && subject.test(m.subject) && m.at >= after).pop();
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
export const tokenFrom = (mail) => /reset-password\?token=([\w-]+)/.exec(mail?.text ?? "")?.[1];
/** Credentials for a freshly invited user, whether the server returned a temp password or emailed a set-password link. */
export async function inviteCredentials(inviteJson, email) {
  if (inviteJson.tempPassword) return inviteJson.tempPassword;
  const mail = await waitForMail(email, /invited you/);
  const token = tokenFrom(mail);
  if (!token) throw new Error(`no invite email for ${email}`);
  const password = "invited-password-123";
  const r = await call("POST", "/api/auth/reset-password", { token, password });
  if (r.status !== 200) throw new Error(`could not redeem invite: ${JSON.stringify(r.json)}`);
  return password;
}
