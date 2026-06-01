# Cel — Bug Fix Brief for AI Agent

> **Generated:** May 31, 2026  
> **Purpose:** Hand this file to an AI coding agent (Codex, Jules, Claude, etc.) to fix all known bugs and issues found during full codebase audit.  
> **Repo:** https://github.com/matthewro7263-hub/cel-source  
> **Live:** https://cel-source.onrender.com

---

## How to use this file

1. Fix issues in order of severity: 🔴 Critical → 🟠 High → 🟡 Medium → 🟢 Minor
2. After each fix, run `pnpm check` (typecheck) and `bun test`
3. Do NOT add new npm dependencies unless explicitly noted
4. Do NOT touch `liquidGL` initialization in `App.tsx`
5. Do NOT add `localStorage`/`sessionStorage` usage
6. When done, mark each item ✅ in this file

---

## 🔴 CRITICAL — Fix These First

### C1 — Schema syntax error: broken `users` table definition

**File:** `shared/schema.ts`  
**Line:** `passwordHash` column definition  
**Problem:** The line is malformed — there are stray spaces merging `passwordHash` and `tokenVersion` onto one broken statement. This likely causes a compile error or silent schema corruption.

**Broken code:**
```ts
passwordHash: text("password_hash").notNull().   tokenVersion: integer("token_version").notNull().default(0),
```

**Fix — split into two proper columns:**
```ts
passwordHash: text("password_hash").notNull(),
tokenVersion: integer("token_version").notNull().default(0),
```

---

### C2 — `deletedAt` defaults to `now()` instead of `null`

**File:** `shared/schema.ts`  
**Affected tables:** `scripts`, `storyboardPanels`, `scenes`, `assets`  
**Problem:** Every table with a soft-delete column has:
```ts
deletedAt: timestamp("deleted_at", { withTimezone: true }).defaultNow()
```
This means every newly created record immediately gets a `deletedAt` timestamp. Any query filtering `WHERE deleted_at IS NULL` returns zero results — soft-delete is completely broken.

**Fix — change all four to:**
```ts
deletedAt: timestamp("deleted_at", { withTimezone: true })
```
(Remove `.defaultNow()` — Drizzle will default to `null` for a nullable column with no default.)

**Tables to fix:**
- `scripts` table
- `storyboardPanels` table  
- `scenes` table
- `assets` table

After fixing the schema, run: `pnpm drizzle-kit push` to apply the migration.

---

### C3 — Missing `await` on `canAccessProject` — ALL MCP endpoints bypass authorization

**File:** `server/mcp_routes.ts`  
**Problem:** `canAccessProject` is an `async` function returning `Promise<boolean>`, but every call is missing `await`. Without it, the `if` check receives a truthy `Promise` object and NEVER blocks access.

**Broken code (repeated in every MCP route):**
```ts
if (!canAccessProject(projectId, req.user!.id)) {
  return mcpError(res, "Forbidden", "FORBIDDEN", 403);
}
```

**Fix — add `await` to every call:**
```ts
if (!await canAccessProject(projectId, req.user!.id)) {
  return mcpError(res, "Forbidden", "FORBIDDEN", 403);
}
```

This affects all 5 MCP route handlers: `list_shots`, `update_shot_status`, `add_comment`, `upload_asset`, `list_assets`. Fix all of them.

---

### C4 — AI keys stored as base64 (not real encryption)

**File:** `shared/schema.ts` — `projectAiKeys` table  
**Problem:** The comment literally says `// base64 obfuscation (NOT real encryption)`. API keys stored in the database as base64 are essentially plaintext.

**Fix:**
1. Use the existing `ENCRYPTION_KEY` env var (already used for AES-256 elsewhere in the app — check `server/storage.ts` for the `encrypt`/`decrypt` helpers).
2. When saving an AI key: call `encrypt(key)` before storing in `encryptedKey`.
3. When reading an AI key to use it: call `decrypt(encryptedKey)`.
4. Update the comment in the schema to accurately describe the encryption.

---

### C5 — `AnimaticEditor` route is missing auth guard

**File:** `client/src/App.tsx`  
**Problem:** The animatic editor route mounts the component with no `ProtectedShell` or `ProtectedFullscreen` wrapper, allowing unauthenticated access.

**Broken code:**
```tsx
<Route path="/projects/:projectId/animatic/:animaticId">
  <AnimaticEditor />
</Route>
```

**Fix:**
```tsx
<Route path="/projects/:projectId/animatic/:animaticId">
  <ProtectedFullscreen><AnimaticEditor /></ProtectedFullscreen>
</Route>
```

---

## 🟠 HIGH PRIORITY

### H1 — `r2.ts` crashes the server on startup if R2 env vars are missing

**File:** `server/r2.ts`  
**Problem:** `required()` is called at module import time. If any R2 env var is absent (common in local dev without R2 configured), the entire server crashes before a single route is registered.

**Fix — lazy-initialize the R2 client:**
```ts
let _r2: S3Client | null = null;

function getR2Client(): S3Client {
  if (_r2) return _r2;
  _r2 = new S3Client({
    region: "auto",
    endpoint: required("R2_ENDPOINT"),
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
  return _r2;
}
```
Replace `r2` usages throughout `r2.ts` with `getR2Client()`. This way, if R2 vars are missing, the error only throws when R2 is actually called, not at server boot.

Also export `R2_BUCKET` lazily:
```ts
function getR2Bucket(): string {
  return required("R2_BUCKET");
}
```

---

### H2 — No rate limiting on auth routes (brute force vulnerability)

**File:** `server/auth_routes.ts`  
**Problem:** `POST /api/auth/login` and `POST /api/auth/register` have no rate limiting. Anyone can attempt unlimited logins. The register endpoint also leaks email existence via a 409 status.

**Fix:**
1. Install `express-rate-limit` (already likely in package.json — check first before installing).
2. Add a rate limiter to the auth router:
```ts
import rateLimit from "express-rate-limit";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "too_many_requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post("/login", authLimiter, (req, res, next) => { ... });
authRouter.post("/register", authLimiter, async (req, res) => { ... });
```

---

### H3 — Achievement `create_panel` check is N+1 queries

**File:** `server/achievements.ts`  
**Problem:** On every panel creation, the code:
1. Lists ALL user projects
2. For each project, lists ALL storyboards
3. For each storyboard, lists ALL panels

For a user with 10 projects × 5 storyboards each = 50+ DB queries on every single panel add.

**Fix — add a count query to `storage.ts` and use it:**
```ts
// In storage.ts — add this method:
async countAllPanelsForUser(userId: number): Promise<number> {
  // Single JOIN query: users → projects → storyboards → panels
  // Use Drizzle's count() with joins
}
```
Then in `achievements.ts` `create_panel` case:
```ts
case "create_panel": {
  await tryUnlock("first_storyboard");
  const totalPanels = await storage.countAllPanelsForUser(userId);
  if (totalPanels >= 10) await tryUnlock("ten_panels");
  if (totalPanels >= 50) await tryUnlock("fifty_panels");
  if (totalPanels >= 100) await tryUnlock("hundred_panels");
  break;
}
```
Apply the same single-query pattern to `create_scene` and `create_comment`.

---

### H4 — `week_streak` achievement logic is incorrect

**File:** `server/achievements.ts`  
**Problem:** The streak check counts unique days from achievement **unlock dates**, not actual login dates. A user who unlocked 7 achievements on 7 different days gets the streak badge even if they only logged in twice.

**Fix:**
1. Add a `userActivityLog` table to `shared/schema.ts`:
```ts
export const userActivityLog = pgTable("user_activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD string
}, (table) => ({
  userDateIdx: index("user_activity_log_user_date_idx").on(table.userId, table.date),
}));
```
2. Insert a row in this table on every `login` event (or every API request, deduped by date).
3. In the `login` achievement check, query for 7+ consecutive distinct dates for the user.
4. Run `pnpm drizzle-kit push` after adding the table.

---

### H5 — `night_owl` and `early_bird` fire on every API call

**File:** `server/achievements.ts`  
**Problem:** The time-based achievement checks run at the top of `checkAchievements` regardless of the event type:
```ts
const hour = new Date().getHours();
if (hour >= 0 && hour < 5) await tryUnlock("night_owl");
if (hour >= 5 && hour < 7) await tryUnlock("early_bird");
```
This means these achievements are checked (and `tryUnlock` is called with a DB query) on EVERY achievement event — create project, create scene, etc.

**Fix — gate these on the `login` event only:**
```ts
if (event === "login") {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 5) await tryUnlock("night_owl");
  if (hour >= 5 && hour < 7) await tryUnlock("early_bird");
}
```

---

### H6 — Duplicate video editor routes

**File:** `client/src/App.tsx`  
**Problem:** Two routes render the exact same component:
```tsx
<Route path="/projects/:id/video">
  {() => <ProtectedShell><VideoEditor /></ProtectedShell>}
</Route>
<Route path="/projects/:id/video-editor">
  {() => <ProtectedShell><VideoEditor /></ProtectedShell>}
</Route>
```

**Fix:** Keep `/projects/:id/video-editor` as canonical. Replace the `/video` route with a redirect:
```tsx
<Route path="/projects/:id/video">
  {(params) => <Redirect to={`/projects/${params.id}/video-editor`} />}
</Route>
```

---

### H7 — `assets.fileData` stored as base64 in Postgres

**File:** `shared/schema.ts` — `assets` table  
**Problem:** The `fileData` column stores full base64-encoded file content directly in the database. This bloats the Postgres DB massively and defeats the purpose of having Cloudflare R2 for storage.

**Fix — migrate assets to use R2 keys:**
1. Rename `fileData text` column to `r2Key text` (or add `r2Key` as a new nullable column while deprecating `fileData`).
2. On asset upload, upload the file bytes to R2 via `presignUpload` in `server/r2.ts` and store the resulting key.
3. On asset read, call `presignDownload(asset.r2Key)` to return a signed URL to the client.
4. Update all references to `fileData` throughout `server/routes.ts`, `server/storage.ts`, `server/mcp_routes.ts`, and the client `AssetsTab.tsx`.

Note: This is a larger migration. Add a migration that keeps the old `fileData` column until all assets are migrated, then drop it.

---

## 🟡 MEDIUM PRIORITY

### M1 — Junk files committed to repo root

**Files to delete:**
- `commit_body.txt`
- `commit_message.txt`  
- `patch.diff`
- `patch2.diff`
- `pr_description.md`
- `pr_description.txt`

**Fix:**
1. Delete all 6 files.
2. Add them to `.gitignore`:
```
# AI tooling artifacts
commit_body.txt
commit_message.txt
patch.diff
patch2.diff
pr_description.md
pr_description.txt
```

---

### M2 — `aud_web_audio.ts.orig` committed

**File:** `client/src/lib/aud_web_audio.ts.orig`  
**Problem:** A `.orig` merge conflict backup file is tracked in git.

**Fix:** Delete the file. Add `*.orig` to `.gitignore`.

---

### M3 — Dual lockfiles (`package-lock.json` + `pnpm-lock.yaml`)

**Files:** `package-lock.json` and `pnpm-lock.yaml` both exist at repo root.  
**Problem:** The project uses pnpm (per `pnpm-workspace.yaml`). Having both confuses CI/CD pipelines and developers.

**Fix:**
1. Delete `package-lock.json`.
2. Add to `.gitignore`:
```
package-lock.json
```

---

### M4 — `ENCRYPTION_KEY` missing from `.env.example`

**File:** `.env.example`  
**Problem:** The README states `ENCRYPTION_KEY` is critical for AES-256 encryption, but it's absent from `.env.example`. New devs will miss it.

**Fix — add to `.env.example`:**
```
# ---- Encryption ----
# 64-char hex string (32 bytes). Generate with: openssl rand -hex 32
ENCRYPTION_KEY=replace-with-64-char-hex-string
```

---

### M5 — `DISCORD_WEBHOOK_URL` in `.env.example` doesn't match implementation

**File:** `.env.example`  
**Problem:** The `.env.example` lists `DISCORD_WEBHOOK_URL` as a server-level env var, but the actual implementation in `server/discord.ts` reads `project.dltDiscordWebhookUrl` from the database per-project. The env var is misleading.

**Fix:**
1. Remove `DISCORD_WEBHOOK_URL` from `.env.example` (it doesn't do anything).
2. Add a comment clarifying Discord webhooks are configured per-project in the project settings UI.

---

### M6 — Pervasive `(req as any)` and `(storage as any)` casts defeat TypeScript

**Files:** `server/auth_routes.ts`, `server/achievements.ts`, `server/mcp_routes.ts`  
**Problem:** Using `(req as any).user`, `(req as any).login`, `(req as any).logout`, `(storage as any).hasAchievement`, etc. means TypeScript provides no type safety on these critical paths.

**Fix:**
1. Extend Express's `Request` type. Create `server/types/express.d.ts`:
```ts
import { User } from "../../shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
```
2. Add the `hasAchievement`, `unlockAchievement`, and `getAchievementUnlockDates` methods to the `Storage` class/interface in `server/storage.ts` so they can be called without `as any`.
3. Remove all `(req as any)` and `(storage as any)` casts.

---

### M7 — `ProtectedShell` and `ProtectedFullscreen` are nearly identical

**File:** `client/src/App.tsx`  
**Problem:** Both components duplicate the same `useAuth` check and loading spinner. The only difference is one wraps in `<AppShell>` and one doesn't.

**Fix — merge into one component with a prop:**
```tsx
function Protected({ children, fullscreen = false }: { children: React.ReactNode; fullscreen?: boolean }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  return fullscreen ? <>{children}</> : <AppShell>{children}</AppShell>;
}
```
Then replace all `<ProtectedShell>` with `<Protected>` and all `<ProtectedFullscreen>` with `<Protected fullscreen>`.

---

### M8 — Express body limit of 50MB applied globally

**File:** `server/index.ts`  
**Problem:** `express.json({ limit: "50mb" })` is applied to ALL routes. Most routes only handle small JSON payloads. The 50MB limit exists only for spritesheet uploads but applies everywhere, making the server vulnerable to large payload attacks on every endpoint.

**Fix — apply large limit only on routes that need it:**
```ts
// Default: 1mb for all routes
app.use(express.json({ limit: "1mb" }));

// In spritesheet_routes.ts, override on the specific route:
router.post("/api/spritesheets", express.json({ limit: "50mb" }), async (req, res) => { ... });
```
Do the same for any other route that legitimately handles large payloads (asset upload, audio upload).

---

## 🟢 MINOR / CLEANUP

### N1 — `(table: any)` in Drizzle table index callbacks

**File:** `shared/schema.ts`  
**Problem:** Every table's index callback uses `(table: any)` instead of the proper inferred type.

**Fix — remove the type annotation and let Drizzle infer it:**
```ts
// Before:
}, (table: any) => { ... });

// After:
}, (table) => { ... });
```
Apply this to all table definitions in `shared/schema.ts`.

---

### N2 — `animaticTracks.volume` stored as text

**File:** `shared/schema.ts`  
**Problem:** `volume: text("volume").notNull().default("1.0")` — the comment says this avoids float precision issues, but the right fix is to use an integer column storing the value * 1000 (milliunits) or just use a `real` / `numeric` Postgres type.

**Fix:**
```ts
volume: integer("volume").notNull().default(1000), // stored as milliunits: 1000 = 1.0, 500 = 0.5
```
Or use Drizzle's `numeric` type if available. Update all read/write code to divide/multiply by 1000.

---

### N3 — `.Jules/` directory and `CODEX_BACKLOG.md` in repo root

**Directory/File:** `.Jules/` and potentially `CODEX_BACKLOG.md`  
**Problem:** `.Jules/` is an AI tooling config directory that should not be committed. `CODEX_BACKLOG.md` is an internal planning doc — it's fine to keep if intentional, but `.Jules/` should not be in version control.

**Fix:** Add to `.gitignore`:
```
.Jules/
```
Then remove the `.Jules/` directory from the repo with `git rm -r --cached .Jules/`.

---

### N4 — `index.css` is 34KB

**File:** `client/src/index.css`  
**Problem:** A 34KB global CSS file suggests accumulated dead styles and duplicated utility classes that Tailwind already handles. This inflates the initial CSS bundle.

**Fix (lower priority):**
- Run `pnpm dlx purgecss` or inspect the file manually for unused class definitions.
- Move any component-specific styles into their respective TSX files using Tailwind classes.
- Remove any utility classes that duplicate what Tailwind provides.

---

### N5 — Missing `sceneId` index on `cli_feedback` table

**File:** `shared/schema.ts`  
**Problem:** `cli_feedback` has a `sceneId` column that's likely used in queries but has no index defined.

**Fix:**
```ts
export const cli_feedback = pgTable("cli_feedback", {
  // ... existing columns
}, (table) => ({
  cliFeedbackProjectIdIdx: index("cli_feedback_project_id_idx").on(table.projectId),
  cliFeedbackSceneIdIdx: index("cli_feedback_scene_id_idx").on(table.sceneId),
}));
```

---

## Summary Checklist

Copy this into your working notes and check off as you go:

### 🔴 Critical
- [ ] C1 — Fix schema syntax error in `users` table (`shared/schema.ts`)
- [ ] C2 — Fix `deletedAt` defaulting to `now()` in 4 tables (`shared/schema.ts`)
- [ ] C3 — Add `await` to all `canAccessProject` calls in `server/mcp_routes.ts`
- [ ] C4 — Use real AES-256 encryption for AI keys (not base64)
- [ ] C5 — Add auth guard to `AnimaticEditor` route in `client/src/App.tsx`

### 🟠 High
- [ ] H1 — Lazy-initialize R2 client so missing env vars don't crash server boot
- [ ] H2 — Add rate limiting to `/api/auth/login` and `/api/auth/register`
- [ ] H3 — Fix N+1 query problem in achievement `create_panel` / `create_scene` / `create_comment`
- [ ] H4 — Fix `week_streak` to track real login activity, not achievement dates
- [ ] H5 — Gate `night_owl`/`early_bird` on `login` event only
- [ ] H6 — Remove duplicate `/video` route (redirect to `/video-editor`)
- [ ] H7 — Migrate assets from base64-in-Postgres to R2 storage keys

### 🟡 Medium
- [ ] M1 — Delete junk files from repo root (`commit_body.txt`, `patch.diff`, etc.)
- [ ] M2 — Delete `aud_web_audio.ts.orig`
- [ ] M3 — Delete `package-lock.json`, keep only `pnpm-lock.yaml`
- [ ] M4 — Add `ENCRYPTION_KEY` to `.env.example`
- [ ] M5 — Fix misleading `DISCORD_WEBHOOK_URL` in `.env.example`
- [ ] M6 — Replace `(req as any)` and `(storage as any)` with proper TypeScript types
- [ ] M7 — Merge `ProtectedShell` and `ProtectedFullscreen` into one `Protected` component
- [ ] M8 — Apply 50MB body limit only to routes that need it, not globally

### 🟢 Minor
- [ ] N1 — Remove `(table: any)` annotations in Drizzle table index callbacks
- [ ] N2 — Change `volume` column from text to integer (milliunits)
- [ ] N3 — Add `.Jules/` to `.gitignore` and remove from repo
- [ ] N4 — Audit and trim `client/src/index.css` (34KB)
- [ ] N5 — Add missing index on `cli_feedback.sceneId`

---

## After all fixes

1. Run `pnpm drizzle-kit push` to apply all schema changes
2. Run `pnpm check` — zero TypeScript errors expected
3. Run `bun test` — all tests must pass
4. Run `pnpm build` — build must succeed with no new warnings
5. Test locally: `node dist/index.cjs` at http://localhost:5000
6. Test in light + dark mode
7. Test unauthenticated access to `/projects/1/animatic/1` — should redirect to `/login`
8. Test creating a new scene — `deletedAt` should be `null`, not a timestamp
