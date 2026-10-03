# Deploying Cel on Render

`render.yaml` at the repo root is the source of truth for the web service. It replaces the hand-edited
dashboard settings and the older `RENDER_READINESS.md` checklist.

## What the blueprint changes (and why)

| Setting | Before | Now |
|---|---|---|
| Build | `npm install --include=dev && npx drizzle-kit push && npm run build` | `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm build` |
| Dependencies | unpinned (`package-lock.json` is git-ignored, so every build resolved fresh versions) | pinned by `pnpm-lock.yaml` |
| Schema changes | `drizzle-kit push` at **build time** against the live database (can alter/drop columns; one failure aborts the deploy after the DB was touched) | versioned SQL in `migrations/`, applied on boot, fatal on failure |
| Health check | none | `/health` — a deploy that can't boot (missing secret, failed migration) never takes traffic |
| Auto deploy | on every commit | after CI passes (`checksPass`) |
| Rebuilds | any push | skipped for docs/test-only changes (`buildFilter`) |
| PR previews | automatic: each PR boots a service **with production's `DATABASE_URL`** and ran `drizzle-kit push` | off |
| Node | Render default | 22 (`NODE_VERSION`) |

Server-side, the app now gzips text responses (JS bundle ~1MB to ~330KB), serves `/assets/*` with
`immutable` caching, sets `keepAliveTimeout` above Render's load balancer idle timeout (avoids sporadic
502s), and shuts down gracefully on SIGTERM so deploys don't drop in-flight requests.

## One-time migration of the existing `cel` service

1. **Check the secrets first.** In Dashboard > cel > Environment make sure these exist, otherwise the new
   build refuses to boot (this is intentional, the health check keeps the old version live):
   - `SESSION_SECRET` — any long random string. Changing it signs everyone out.
   - `ENCRYPTION_KEY` — **keep the value you already use**. Replacing it makes previously saved AI keys
     undecryptable (users re-enter them). If none was ever set, generate one: `openssl rand -hex 32`.
   - `DATABASE_URL` (Neon).
2. Merge the branch, then Dashboard > **Blueprints > New Blueprint Instance**, pick this repo, and select the
   existing `cel` service when Render offers to adopt it (or create fresh and delete the old one).
3. Delete the stale `cel PR #81 / #87 / #88` preview services; they are leftovers of automatic previews and
   still point at the shared database.
4. **Email (optional, recommended).** Without it, "Forgot password?" can't deliver links and invited people
   are handed a temporary password instead. Create a [Resend](https://resend.com) API key and verify a sending
   domain, then set `RESEND_API_KEY`, `MAIL_FROM` (e.g. `Cel <hello@your-domain.com>`) and `APP_URL`
   (your public URL, used in the links). Resend's default sandbox sender only delivers to your own address.
   Also set `CONTACT_EMAIL` so the Privacy and Terms pages show a contact.
5. Optional but recommended on the free plan: set `plan: starter` so the instance doesn't sleep, and so the
   in-process weekly leaderboard timer actually fires.

## Database

* Fresh database: nothing to do, the first boot runs `migrations/0000_baseline.sql` and onward.
* Existing database created by `drizzle-kit push`: also fine. Every migration is idempotent
  (`IF NOT EXISTS`), so the baseline is a no-op and `0016`/`0017` add the missing columns and tables.
* Neon: `*.neon.tech` hosts use the serverless driver automatically; any other Postgres uses
  node-postgres (`CEL_DB_DRIVER=neon|pg` to force).

## Operating it

* Logs: Dashboard > Logs, or the Render MCP `list_logs` tool (filter `type=app`).
* Liveness: `GET /health`. Dependency status (DB, R2): `GET /ready` (503 when the DB is unreachable).
* Without `R2_*` set the app stores panel images and script originals inline in Postgres; set them once you
  expect large projects, because inline data makes the database grow quickly.
