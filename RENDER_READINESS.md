# Render Readiness — feat/liquid-glass

**Audit date:** 2026-06-09  
**Target:** https://cel-source.onrender.com  
**Branch audited:** `feat/liquid-glass` (`63e4680`)

---

## Verdict

| Category | Status | Notes |
|----------|--------|-------|
| **Build** | ✅ PASS | `NODE_ENV=production npm run build` succeeds |
| **Typecheck** | ✅ PASS | `npx tsc --noEmit` clean |
| **Tests** | ✅ PASS | `bun test` 29/29 |
| **Boot (local)** | ⚠️ BLOCKED | Requires `DATABASE_URL` at import — crashes without it (expected) |
| **Functional readiness** | ❌ NO-GO | P0 auth bypasses + broken R2 thumbnails block artist workflows |
| **Deploy to Render** | ⚠️ CONDITIONAL | Build/start commands work; app will boot on Render with env vars; features broken until Hotfix A+B |

---

## Build Pipeline

| Step | Command | Result | Artifact |
|------|---------|--------|----------|
| Client build | Vite via `script/build.ts` | ✅ 6.8s | `dist/public/` (index.html + 25 JS chunks) |
| Server bundle | esbuild CJS | ✅ 122ms | `dist/index.cjs` (1.4 MB) |
| Static path | `server/static.ts` | ✅ | Resolves `dist/public` relative to bundle |

**manualChunks verified:** `react-vendor`, `query`, `dnd-kit`, `recharts`, plus lazy chunks `StoryboardsTab`, `ProjectWorkspace`, `Dashboard`.

**New dependency:** `@tanstack/react-virtual` in `package.json` — Render `npm ci` will install ✅

---

## Render Configuration Checklist

| Item | Expected on Render | Code location | Status |
|------|-------------------|---------------|--------|
| Build command | `npm run build` | `package.json` scripts | ✅ |
| Start command | `npm start` → `node dist/index.cjs` | `package.json` | ✅ |
| `NODE_ENV` | `production` | Render sets automatically | ✅ |
| `PORT` | Render-assigned | `server/index.ts:205` | ✅ |
| `HOST` | `0.0.0.0` (default) | `server/index.ts:206` | ✅ |
| `DATABASE_URL` | Neon Postgres connection string | `storage.ts:89` — **required at import** | ⚠️ Must be set in Render dashboard |
| `SESSION_SECRET` | Strong random string | `storage.ts:136` | ⚠️ Required for auth |
| `ENCRYPTION_KEY` | 64-char hex | `crypto.ts` | ⚠️ Required for AI key encryption |
| R2 vars | `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | `r2.ts` lazy init | ✅ Boot OK without; upload routes fail at call time |
| `CEL_ALLOWED_ORIGINS` | `https://cel-source.onrender.com` | `index.ts:24-41` | ✅ Default includes Render URL |
| `trust proxy` | Enabled | `index.ts:22` | ✅ Correct for Render reverse proxy |

---

## Health Probes

| Endpoint | Purpose | Expected | Status |
|----------|---------|----------|--------|
| `GET /health` | Liveness | `200 { ok: true }` | ✅ Implemented |
| `GET /ready` | DB readiness | `200 { ok, db: "connected" }` or `503` | ✅ Implemented (`pool.connect()` + `SELECT 1`) |

**Render recommendation:** Point health check to `/health` (liveness). Use `/ready` only if you want deploy gate on DB — note cold-start on free tier may delay first `/ready` success.

---

## Startup Sequence (cold start)

```
1. Import storage.ts → requires DATABASE_URL (crash if missing)
2. runMigrations() → drizzle migrator, migrations/ folder (includes 0015)
3. seedIfEmpty()
4. startLeaderboardCron()
5. registerRoutes + auxiliary route modules
6. serveStatic(dist/public) in production
7. listen(PORT, 0.0.0.0)
```

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migration failure logged but startup continues | Medium | Monitor logs for `Database migration failed`; 0015 uses `IF NOT EXISTS` |
| `reusePort: true` | Low | Test on Render; set `REUSE_PORT=false` if listen fails |
| Large bundle cold start (~1.4 MB) | Low | Acceptable; esbuild allowlist reduces syscalls |
| JSON.stringify on large API responses in logging | Low | Perf overhead on list endpoints; not a deploy blocker |

---

## Same-Origin API (unified deploy)

Built client uses `API_BASE=""` in [`queryClient.ts`](client/src/lib/queryClient.ts) — correct for Render single-service deploy where API and SPA share `cel-source.onrender.com`. ✅

---

## Smoke Matrix (run on Render after deploy)

| # | Test | Pass criteria |
|---|------|---------------|
| 1 | `GET /health` | 200 |
| 2 | `GET /ready` | 200 with DB |
| 3 | `GET /` | Returns index.html |
| 4 | `GET /assets/*.js` | 200 (no 404 on manualChunks) |
| 5 | `GET /api/auth/me` | 401 (not 500) |
| 6 | Login → `GET /api/projects` | 200 with projects |
| 7 | Open project storyboards | Panels visible (requires Hotfix B) |
| 8 | Upload panel via R2 presign | Panel appears with thumbnail (requires Hotfix B) |
| 9 | Dashboard production queue | Last panel thumbnail visible (requires Hotfix B) |
| 10 | Cmd+K → jump to project | Route loads (lazy spinner OK) |

**Items 7–9 will fail on current branch** due to RC-1 (R2 img auth). Mark as post-Hotfix-B verification.

---

## Environment Variables for Render Dashboard

```env
NODE_ENV=production
DATABASE_URL=<neon-connection-string>
SESSION_SECRET=<openssl rand -hex 32>
ENCRYPTION_KEY=<openssl rand -hex 32>
R2_ACCOUNT_ID=<cloudflare>
R2_BUCKET=cel-source-uploads
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
CEL_ALLOWED_ORIGINS=https://cel-source.onrender.com
```

---

## Go/No-Go for Render Deploy

| Scenario | Decision |
|----------|----------|
| Deploy current `feat/liquid-glass` as-is | **NO-GO** — auth bypasses + broken R2 UI |
| Deploy after Hotfix A only | **NO-GO** — panels still invisible |
| Deploy after Hotfix A + B | **GO** — core artist paths restored |
| Deploy after full A–D | **GO** — recommended for production quality |

---

## Local Prod Simulation Results

```bash
# Executed during audit:
npx tsc --noEmit                    # exit 0
bun test                            # 29 pass
NODE_ENV=production npm run build   # exit 0, dist/ created
NODE_ENV=production npm start       # exit 1: "DATABASE_URL is required"
```

Local boot failure without `DATABASE_URL` is **expected behavior** — Render provides this env var. Build artifacts are valid for deploy.