# Render deploy & stability bundle

Consolidated changes landed after PR #77 (storyboard inspector / dashboard).

## Render deploy blockers (ff18482)

- Register Drizzle migrations `0012`–`0014` in `migrations/meta/_journal.json`
- Lazy-load `canvas` via `server/canvas_lazy.ts` (archive + spritesheet routes)
- Wrap `seedIfEmpty()` in try/catch so missing DB does not crash boot
- Align `.env.example` with Render (`PORT`, `CEL_ALLOWED_ORIGINS`, `ENCRYPTION_KEY`)

## Auth & session (7125d64 … e367c1e)

- Absolute migrations path + neon-serverless Pool/ws migrator
- Persist auth token to `localStorage`; fix ProtectedShell race / 401 bounce
- Include `tokenVersion` in HMAC session verification payload

## Security & types (353c271, 19acd76, 21698b0)

- Body size limits; TypeScript null-safety across server routes
- Bug fixes from open GitHub PRs; `lor_routes` `await canAccessProject`

## Challenge leaderboard (cherry-picked to main)

- `shared/challenge_leaderboard_schema.ts`, migration `0014`, cron + routes
- `Leaderboard.tsx` on challenge page
- Supersedes open PR #49 — close #49 after merge

## Cloudflare R2 (unchanged API)

- `server/r2.ts` presign upload/download
- `server/uploads_routes.ts` mounted at `/api/uploads`
- Script originals + bulk panel import + `/api/uploads/file` redirect

## Verification

```bash
npx tsc --noEmit
bun test
npm run build
```