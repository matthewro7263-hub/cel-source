# Audit Findings — feat/liquid-glass

**Branch:** `feat/liquid-glass` (`63e4680`)  
**Date:** 2026-06-09  
**Method:** 4 parallel readonly audit subagents + Agent 5 consolidation  
**Gates:** `tsc` ✅ · `bun test` 29/29 ✅ · `NODE_ENV=production npm run build` ✅

---

## Executive Summary

The performance waves introduced **lite API payloads** and **R2-first panel uploads**, but the migration is half-wired. The dominant failure mode is **R2-backed panels**: list endpoints omit `imageData`, clients fall back to `/api/uploads/file?key=…` in `<img src>`, which cannot send Bearer auth — thumbnails break in storyboards, dashboard, and all downstream tools that read `panel.imageData` only.

Three **critical security issues** were found: review-room WebSocket auth bypass (missing `await`), AI agent endpoint missing project access check, and `tokenVersion` never enforced on sessions.

**Total unique issues:** 52 (deduplicated from ~65 raw findings across agents)

| Severity | Count | Ship blocker? |
|----------|-------|---------------|
| P0 Critical | 8 | Yes |
| P1 High | 18 | Yes (artist workflows) |
| P2 Medium | 19 | No (degrade gracefully) |
| P3 Low | 7 | No |

---

## Root Cause Clusters

### RC-1: R2 media delivery not browser-safe (P0)

**IDs:** MEDIA-002, MEDIA-003, COL-03, COL-04  
**Root cause:** `/api/uploads/file` requires Bearer auth; `<img>` cannot send it. `isOwnedKey` blocks collaborators.

**Affected:** StoryboardsTab, Dashboard, any future `r2Key` img usage.

**Chosen fix strategy (deconflicted):** Do NOT restore `imageData` on list APIs. Instead:
1. Add project-scoped media route: `GET /api/projects/:id/media?key=…` (checks `canAccessProject` + key belongs to project)
2. Add share-scoped route: `GET /api/share/:token/media?key=…`
3. Shared client helper `resolvePanelImageUrl(panel, { projectId?, shareToken? })` using authenticated fetch → blob URL for `<img>`, or server-returned presigned URL in DTOs

### RC-2: Lite payloads break downstream consumers (P0/P1)

**IDs:** MEDIA-001, MEDIA-004, MEDIA-005, MEDIA-012, MEDIA-013–015  
**Root cause:** `listPanelsLiteBatch` omits `imageData`; `listAnimaticsLite` omits `videoData`. 10+ clients still read inline blobs.

**Chosen fix strategy:** Keep lite lists for perf; add resolved URLs in DTOs OR per-resource fetch endpoints. Restore `videoData` on share endpoint only (or full `listAnimatics` for share).

### RC-3: React Query cache fragmentation (P1)

**IDs:** QK-01, QK-02, QK-03, QK-04  
**Root cause:** Factory keys (`queryKeys.storyboards`) vs template literals (`/api/projects/${id}/storyboards`) create duplicate cache entries. Invalidations don't propagate.

**Files to migrate:** video-editor, compare, couch-mode, review-room, SpriteSheet, couch-mode/review-room comments.

### RC-4: StoryboardsTab dual state (P1)

**IDs:** SB-01, SB-02, COL-09, COL-10, MU-01  
**Root cause:** Local `panels` state synced only on `board.panels.length`; optimistic cache patches don't update local state; reorder lacks error rollback.

### RC-5: Server auth & missing methods (P0)

**IDs:** A3-001, A3-003, A3-004, A3-002  
**Root cause:** Async auth check without await; missing storage getters called via `(storage as any)`.

---

## P0 Critical Issues

| ID | Source | Location | Description |
|----|--------|----------|-------------|
| **SEC-001** | A3-001 | `server/review_room.ts:49` | `canAccessProject` not awaited → any authed user joins any review room |
| **SEC-002** | A3-003 | `server/routes.ts:1680` | AI agent check has no `canAccessProject` → steal other projects' API keys |
| **MEDIA-002** | Agent1/4 | `uploads_routes.ts:68`, StoryboardsTab, Dashboard | R2 thumbnails via `<img src="/api/uploads/file">` → 401 (no Bearer) |
| **MEDIA-003** | Agent1 | `r2.ts:96`, `uploads_routes.ts:72` | `isOwnedKey` uploader-only → collaborators can't view others' R2 panels |
| **MEDIA-004** | Agent1 | `storage.ts:355`, `routes.ts:756` | `listAnimaticsLite` omits `videoData` → animatics tab, video-editor, compare broken |
| **MEDIA-005** | Agent1 | `routes.ts:1386`, `Share.tsx:179` | Share uses lite animatics → all shared animatics empty |
| **MEDIA-001** | Agent1 | `storage.ts:284`, 10+ clients | Lite panel list omits `imageData`; most consumers don't read `r2Key` |
| **DL-01** | Agent2 | `StoryboardsTab.tsx:105` | `?panel=` deep link reads `window.location.search` not hash query → broken under hash router |

---

## P1 High Issues

| ID | Source | Location | Description |
|----|--------|----------|-------------|
| **SEC-003** | A3-004 | `routes.ts:1817,1833,1879,2093` | `getCommissionLineItem`, `getCommissionPricingPreset`, `getAudCaption` missing from storage → runtime TypeError |
| **SEC-004** | A3-002 | `routes.ts:38`, `storage.ts:148` | `tokenVersion` in session never validated → can't revoke sessions |
| **QK-01** | Agent2 | 5 client files | Storyboard query key split → stale panels in video-editor, compare, couch, review-room |
| **QK-02** | Agent2 | couch-mode, review-room | Comments invalidation key mismatch → CommentsTab stale |
| **SB-01** | Agent2 | `StoryboardsTab.tsx:227` | Local panels sync only on length change |
| **SB-02** | Agent2 | `StoryboardsTab.tsx:361` | Reorder optimistic with no rollback on failure |
| **MU-01** | Agent2 | `StoryboardsTab.tsx:265` | Reorder mutation no `response.ok` check |
| **MEDIA-006** | Agent1 | `Share.tsx:143` | Share panels R2-only render blank (only reads `imageData`) |
| **MEDIA-007** | Agent1 | `routes.ts:1371` | No unauthenticated share media endpoint for R2 |
| **MEDIA-008–011** | Agent1 | AssetsTab, routes | R2 assets: no preview, no download, AudioDialog asset_ref broken |
| **MEDIA-012** | Agent1 | 8 client files | Storyboard consumers read `imageData` only |
| **MEDIA-013–015** | Agent1 | spritesheet, archive, bak | Server exports skip R2-only panels/assets |
| **COL-01** | Agent4 | `App.tsx:127` | `data-liquid-ready` sticky flag → glass never re-inits after leaving projects |
| **COL-05** | Agent4 | bulk import, Dashboard | Production queue not invalidated after panel mutations |
| **COL-06** | Agent4 | bulk-panel-import | R2 upload succeeds but DB bulk fails → orphaned R2 objects |
| **COL-09** | Agent4 | StoryboardsTab | Optimistic captions don't update local `panels` state |
| **COL-11** | Agent4 | ProjectWorkspace, scene-timer | Scene timers aggregation fetched but not passed to buttons → N+1 |
| **COL-13** | Agent4 | challenge_routes | Server leaderboard cache not busted on reactions → 30s stale |

---

## P2 Medium Issues

| ID | Description |
|----|-------------|
| A3-005 | `accessCache` not invalidated on member add/remove (60s stale grant) |
| A3-006 | Scene timer endpoint leaks all users' entries |
| A3-007 | `reorderPanels` no permutation validation |
| A3-008 | `listPanelsLite` returns soft-deleted panels |
| A3-010 | `checkAchievements` not wired to active auth routes |
| QK-03/04 | Assets query key `"all"` vs `undefined` drift |
| MU-02–04 | Panel/storyboard mutations lack `ok` checks |
| DL-02 | No scroll-into-view for panel deep link |
| LZ-01/02 | Incomplete lazy-loading coverage |
| DI-01 | Dead `@dnd-kit` imports in ProjectWorkspace |
| COL-02,05,07,10,12,14,16–20 | liquidGL, bulk import, leaderboard, cache leaks, Cmd+K |
| MEDIA-016–018 | Type drift, asset upload still base64 |

---

## P3 Low Issues

| ID | Description |
|----|-------------|
| A3-009,011,013 | Migration snapshots, `(storage as any)` cleanup, review room re-auth |
| QK-05,06 | Factory adoption in aligned-but-manual files |
| DL-03, LZ-03, DI-02–04 | Minor routing, chunking, cleanup |
| COL-08,15,21 | Code dedup, leaderboard key shape, Cmd+K project title |

---

## Cross-Agent Collision Matrix

| Feature A | Feature B | Conflict | Resolution |
|-----------|-----------|----------|------------|
| Lite panel API (perf) | R2 upload (Wave 1) | Downstream can't display panels | RC-1 media routes + shared resolver |
| Restore `imageData` on list | Payload size (perf goal) | Undoes Wave 1/2 wins | Rejected — use URL resolution instead |
| Pins aggregation | Per-panel overlay | None — works | Keep |
| Scene timers endpoint | SceneTimerButton | Endpoint unused | Pass `timerData` prop |
| liquidGL disable | AppShell glass | CSS fallback OK; sticky flag bad | Reset `data-liquid-ready` on route change |
| Pagination API | UI | Silent 50-item cap | Add load-more or raise default |
| Optimistic captions | Local `panels` | Duplicate PATCH | Sync local state in `onMutate` |
| Bulk import R2 | DB bulk insert | Orphaned R2 on failure | Rollback/delete keys on DB failure |

---

## Verification Baseline (pre-fix)

```
npx tsc --noEmit          → PASS
bun test                  → 29/29 PASS
NODE_ENV=production npm run build → PASS (dist/public + dist/index.cjs)
NODE_ENV=production npm start     → FAIL without DATABASE_URL (expected; Render sets this)
```

---

## Go/No-Go

**Recommendation: NO-GO for production merge to `main` without Hotfix A + B.**

- Hotfix A (auth/runtime) is a security requirement
- Hotfix B (R2 media) is required for the R2 upload path introduced in this branch to actually work in the UI

Hotfixes C and D can ship in the same PR or follow immediately after.