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
