#!/usr/bin/env node
// Black-box integration suite: boots the *production bundle* against a real Postgres, then drives
// the HTTP API (and the review-room WebSocket) the way the client does.
//
//   DATABASE_URL=postgres://user:pass@localhost:5432/cel_it pnpm test:integration
//
// The database is migrated on boot (so this also proves a fresh DB works) and demo data is seeded.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const PORT = process.env.IT_PORT ?? "5057";
const MOCK_PORT = process.env.IT_MOCK_PORT ?? "5099";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (point it at a throwaway Postgres database).");
  process.exit(2);
}
if (!existsSync(join(root, "dist", "index.cjs"))) {
  console.log("dist/ missing, building first…");
  if (spawnSync("pnpm", ["build"], { cwd: root, stdio: "inherit" }).status !== 0) process.exit(2);
}

const children = [];
const stop = () => children.forEach((c) => c.kill("SIGTERM"));
process.on("exit", stop);
process.on("SIGINT", () => process.exit(130));

// Mock OpenRouter (the AI endpoints call out to it).
children.push(spawn(process.execPath, [join(here, "mock-openrouter.mjs")], { env: { ...process.env, MOCK_PORT }, stdio: "inherit" }));

const env = {
  ...process.env,
  NODE_ENV: "production",
  PORT,
  HOST: "127.0.0.1",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "integration-test-session-secret",
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? "ab".repeat(32),
  CEL_SEED_DEMO: "true",
  CEL_ADMIN_EMAILS: "matthew@cel.app",
  OPENROUTER_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
};
delete env.R2_BUCKET; delete env.R2_ENDPOINT; // exercise the "no cloud storage" paths
const server = spawn(process.execPath, [join(root, "dist", "index.cjs")], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
children.push(server);
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
server.on("exit", (code) => { if (code) { console.error(`server exited early (${code}):\n${serverLog}`); process.exit(1); } });

const base = `http://127.0.0.1:${PORT}`;
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  await new Promise((r) => setTimeout(r, 500));
  up = await fetch(`${base}/health`).then((r) => r.ok).catch(() => false);
}
if (!up) { console.error("server did not become healthy:\n" + serverLog); process.exit(1); }

const suites = ["api-core", "share", "script-upload", "exports-and-ws", "media-urls", "ai", "api-modules", "trash-and-snapshots", "accounts", "client-payloads", "roles"];
const failed = [];
for (const name of suites) {
  console.log(`\n=== ${name}`);
  const res = spawnSync(process.execPath, [join(here, `${name}.mjs`)], { env: { ...process.env, BASE: base }, stdio: "inherit" });
  if (res.status !== 0) failed.push(name);
}

console.log(failed.length ? `\nFAILED suites: ${failed.join(", ")}` : "\nAll integration suites passed.");
if (failed.length) console.log("\n--- server log (tail) ---\n" + serverLog.split("\n").slice(-40).join("\n"));
process.exit(failed.length ? 1 : 0);
