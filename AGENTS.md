# AGENTS.md

## Cursor Cloud specific instructions

Cel is a **single deployable app** (not a multi-package monorepo): one Express process
(`server/`) serves both the JSON API and the React/Vite SPA (`client/`) on one port.
Shared Drizzle schema + Zod validators live in `shared/`. Standard commands are defined in
`package.json` scripts and `README.md`; prefer those. Notes below cover only the
non-obvious, durable caveats for running this app in the Cursor Cloud VM.

### Services to start (in this order)

The VM snapshot already has PostgreSQL 16, the local Neon proxy, and its certs installed.
Dependencies are refreshed automatically by the startup update script (`pnpm install`).
You only need to (re)start these services:

1. **PostgreSQL** (must be running before the app/db commands):
   ```bash
   sudo pg_ctlcluster 16 main start   # idempotent; "already running" is fine
   ```
   DB `cel` owned by role `cel` (password `cel`) already exists with the full schema applied.

2. **Local Neon WebSocket proxy** (REQUIRED — see why below). Run it in its own
   tmux session and leave it running:
   ```bash
   cd /workspace
   sudo /exec-daemon/node /home/ubuntu/neon-local-proxy.mjs
   ```
   It listens on `wss://127.0.0.1:443/v2` and forwards to local Postgres `127.0.0.1:5432`.

3. **Dev server**: `pnpm dev` (binds `0.0.0.0:5000`). Health: `GET /health`; readiness
   (`db`/`r2` status): `GET /ready` — expect `{"db":"connected","r2":"not_configured"}`.

### Why the Neon proxy is required (non-obvious)

`server/storage.ts` connects with `@neondatabase/serverless`, which speaks the Postgres
protocol over a **secure WebSocket** and refuses a plain local Postgres TCP connection.
With its default config the driver dials `wss://<DATABASE_URL-host>/v2` (no `?address=`
param), so a normal `wsproxy` won't match without editing app code. `/home/ubuntu/neon-local-proxy.mjs`
is a tiny TLS WebSocket→TCP bridge that **defaults its upstream to `127.0.0.1:5432`** when no
`?address=` is supplied, so no app code change is needed. Because its cert is self-signed,
the app process must run with `NODE_TLS_REJECT_UNAUTHORIZED=0` — this is already set in
`/workspace/.env` (dev only). `pnpm db:push` and `pnpm dev` both load `.env` via `dotenv`.

If `/workspace/.env` is missing, recreate it with: `NODE_ENV=development`, `PORT=5000`,
`NODE_TLS_REJECT_UNAUTHORIZED=0`, `DATABASE_URL=postgres://cel:cel@127.0.0.1:5432/cel`,
plus a random `SESSION_SECRET` and a 64-char-hex `ENCRYPTION_KEY` (`openssl rand -hex 32`).

### Other gotchas

- **`reusePort` lets duplicate servers bind :5000.** The server sets `reusePort: true`, so
  multiple `pnpm dev` instances can silently coexist on port 5000 and cause flaky/403
  responses. Ensure exactly one dev server runs; kill extras by **specific PID** (never by name).
- **Dev-mode (`tsx`) logs two harmless errors** that do NOT occur in the production build:
  `runMigrations` fails with `__dirname is not defined` and the seeder logs
  `require is not defined`. These are ESM-vs-CJS quirks. They are non-fatal — the schema is
  fully created by `pnpm db:push` and a demo user (`matthew@cel.app` / `celdemo`) is still seeded.
- **Schema creation uses `db:push`, not `migrations/`.** `migrations/` only contains
  incremental drift (0010–0015); base tables come from `drizzle-kit push` off `shared/*.ts`.
  A plain `pnpm db:push` currently ABORTS on a type-mismatch FK in the unused
  `shared/r2_schema.ts` (`user_id uuid` → integer `users.id`; that file is imported nowhere).
  To apply the full schema cleanly, push with a config that excludes that one file:
  `pnpm drizzle-kit push --config=/home/ubuntu/drizzle.setup.config.ts`.
- **`canvas` native module** is compiled in the VM snapshot (needs cairo/pango libs) and is
  **lazy/optional** (`server/canvas_lazy.ts`) — the server boots without it; only
  spritesheet/archive image features need it. A fresh `pnpm install` ignores its build
  script; if `canvas` is missing after reinstall, rebuild it with:
  `cd node_modules/.pnpm/canvas@*/node_modules/canvas && npm run install`.
- **Tests** run with **Bun** (`bun test`, installed at `~/.bun/bin`), not Node. Typecheck is
  `pnpm check` (`tsc`); there is no ESLint/Prettier config.
