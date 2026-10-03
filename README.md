<div align="center">

# Cel

### Make your animation. Not your spreadsheet.

**Cel** is an all-in-one animation production hub for solo creators, fan-artists, and indie animators. Storyboards, animatics, scripts, palettes, audio, and commissions - in one quiet place.

[Live Demo](https://cel-source.onrender.com) - [Report a Bug](https://github.com/matthewro7263-hub/cel-source/issues) - [Request a Feature](https://github.com/matthewro7263-hub/cel-source/issues/new)

![Status](https://img.shields.io/badge/status-active-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Node](https://img.shields.io/badge/Node-20.x-339933?logo=node.js&logoColor=white)

</div>

---

## What Cel does

Cel replaces the patchwork of Notion docs, Google Sheets, Trello boards, and Drive folders that indie animators normally juggle. One project. One workspace. Every stage from concept to delivery.

| Stage | What you get |
|---|---|
| **Script** | Live-preview Markdown editor for scenes, beats, and dialogue. Upload existing scripts as PDF, DOCX, or Markdown and view them inline - no retyping. |
| **Storyboards** | Per-shot boards with reference uploads, version snapshots, and review threads. |
| **Animatic** | Timeline-based shot sequencing with audio sync and rough timing. |
| **Audio** | Per-scene audio bins, waveform previews, and dialogue/music/sfx tracks. |
| **Palette tools** | Build, lock, and export palettes per character or scene. |
| **Collaboration** | Invite members, role-based access (owner / editor / reviewer), in-app review rooms with approval flows. |
| **Commissions** | A queue for paid work: client briefs, milestone tracking, deliverable approval, and revision history. |
| **Pipeline** | Bird's-eye dashboard of where every shot in every project actually is. |
| **Discord integration** | Push status updates and review-ready pings to your team's Discord. |

---

## Quick start

### Try it hosted

Open **[cel-source.onrender.com](https://cel-source.onrender.com)** and click **Start Creating - Free**. (The free instance sleeps after 15 min of inactivity; first request may take ~50 seconds to wake.)

### Run it locally

**Prerequisites**
- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 9+
- [Bun](https://bun.sh) (used for tests + some scripts)
- A Postgres database (local or [Neon](https://neon.tech))
- *(Optional)* Cloudflare R2 bucket for asset storage

**Setup**

```bash
git clone https://github.com/matthewro7263-hub/cel-source.git
cd cel-source
pnpm install
cp .env.example .env.local
# fill in DATABASE_URL, R2 keys, ENCRYPTION_KEY, etc.
pnpm drizzle-kit push      # apply schema
pnpm dev                   # starts client + server on :5173
```

Then open http://localhost:5173.

**Run the tests**

```bash
bun test
pnpm check                 # typecheck
```

---

## Tech stack

- **Frontend:** React 18 + Vite + TypeScript, TanStack Query, wouter (routing), Radix UI + Tailwind, Lucide icons
- **Backend:** Node.js + Express, Drizzle ORM
- **Database:** PostgreSQL (Neon in production)
- **Storage:** Cloudflare R2 (S3-compatible) for uploads
- **Auth:** Cookie/JWT sessions
- **Notifications:** Discord webhooks
- **Hosting:** Render (web service) + Neon (Postgres) + R2 (assets)
- **Tests:** Bun's built-in test runner

---

## Project structure

```
cel-source/
  client/              # React app
    src/
      pages/           # Route-level views (ProjectWorkspace, Dashboard, etc.)
      components/      # UI components (Radix-based design system)
      hooks/           # React hooks (useToast, useAuth)
      lib/             # API client + utilities
  server/              # Express API
    routes.ts          # All HTTP routes
    storage.ts         # DB access layer (Drizzle queries)
    discord.ts         # Discord webhook integration
  shared/              # Code shared between client and server
    schema.ts          # Drizzle schema + Zod validators
  docs/                # In-repo documentation
  drizzle.config.ts    # Migration config
```

---

## Testing

```bash
pnpm check              # TypeScript
pnpm lint               # React hook-order rules (ESLint)
pnpm test               # unit tests (bun)
# Black-box API/WebSocket suite against the production bundle and a real Postgres:
createdb cel_it && DATABASE_URL=postgres://localhost:5432/cel_it pnpm test:integration
```

`pnpm test:integration` boots `dist/index.cjs`, so it also proves a fresh database migrates and
that the "no R2 configured" fallbacks work. CI runs all of the above.

For local development any Postgres works (`DATABASE_URL=postgres://...`); the Neon serverless driver is
only used for `*.neon.tech` hosts (override with `CEL_DB_DRIVER=neon|pg`).

---

## Environment variables

See [.env.example](./.env.example). The critical ones:

| Variable | What it does |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `ENCRYPTION_KEY` | 64-char hex (32 bytes) for AES-256 at-rest encryption. Generate with `openssl rand -hex 32` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Cloudflare R2 credentials |
| `DISCORD_WEBHOOK_URL` | *(optional)* default Discord channel for notifications |
| `SESSION_SECRET` | **Required in production.** Signs session tokens. Generate with `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | **Required in production** (see above) |
| `CEL_ADMIN_EMAILS` | *(optional)* comma-separated emails allowed to create challenge prompts / snapshots |
| `CEL_RATE_LIMIT_SCALE` | *(optional)* multiplier for the signup/login/commission/AI rate limits (default `1`); raise it behind a shared office NAT |
| `RESEND_API_KEY` | *(optional)* enables email (password reset, invites, commission notifications) via [Resend](https://resend.com); without it, reset links are unavailable and invitees get a temporary password |
| `MAIL_FROM` | *(optional)* sender, e.g. `Cel <hello@your-domain.com>` (must be a verified Resend domain; defaults to Resend's sandbox sender, which only delivers to your own address) |
| `APP_URL` | *(recommended with email)* public origin used in email links, e.g. `https://cel.onrender.com` (falls back to `RENDER_EXTERNAL_URL`) |
| `CONTACT_EMAIL` | *(optional)* shown on the Privacy and Terms pages |
| `CEL_SEED_DEMO` | *(optional)* set to `true` to seed demo accounts in production (they use a public password) |
| `FREESOUND_API_KEY` | *(optional)* enables sound-effect search |
| `CEL_DB_DRIVER` | *(optional)* `neon` or `pg`. Defaults to Neon's driver for `*.neon.tech` hosts and node-postgres elsewhere |
| `OPENROUTER_BASE_URL` | *(optional)* override the OpenRouter API base (tests / OpenAI-compatible proxies) |
| `CEL_MIGRATIONS_DIR` | *(optional)* migrations folder (default `./migrations` relative to the working directory) |

R2 is optional: without `R2_*` set, panel images and script originals fall back to inline storage
(`/ready` reports `r2: not_configured`).

Never commit `.env.local`. `.env.example` is the safe template.

---

## Contributing

Cel is built in public. PRs welcome.

1. Fork, then create a feature branch (`feat/<thing>` or `fix/<thing>`)
2. `pnpm install && pnpm check && bun test` should all pass
3. Open a PR against `main`
4. CI runs typecheck, lint and tests; merging to `main` deploys to Render (see [docs/RENDER.md](docs/RENDER.md))

For larger features, open an issue first so we can align on scope.

---

## Roadmap

- [x] Script upload (PDF / DOCX / Markdown) with in-app viewer
- [x] Discord notifications for review-ready shots
- [x] Snapshot-based version history
- [ ] iPad-friendly storyboard view
- [ ] Real-time multi-cursor collaboration on scripts
- [ ] HDR-aware palette tools
- [ ] Public portfolio pages for finished work

---

## License

MIT (c) [matthewro7263-hub](https://github.com/matthewro7263-hub)

---

<div align="center">
Made for animators who'd rather be drawing.
</div>
