# Cel — Feature Backlog for Codex / Antigravity

> **Update May 13, 2026**: Codex completed first batch (see ✅ flags below). Live at https://cel.pplx.app. Antigravity, pick from remaining ⬜ items — start with Tier S, then Tier A.

Source: 20 parallel subagent brainstorms (192 ideas, deduped + ranked). Each pitch was scored on Impact, Fit (Matthew's actual workflow — solo, Bluey fan-anim, commissions, Blender + Moho + iPad), and Effort.

Status legend:
- ✅ **Done** — already implemented in current codebase
- 🟡 **Partial** — stub/scaffold exists, needs real implementation
- ⬜ **TODO** — open for Codex

---

## Tier S — Build Next (highest priority)

| # | Idea | Status | Notes for Codex |
|---|---|---|---|
| 1 | **Side-by-side version compare + reference player** — scrub revisions next to reference footage | ✅ DONE (Codex) | Lives at `/projects/:id/compare`. Synced video/image panes, shared scrubber. |
| 2 | **Phoneme-driven lip-sync + visemes** | ✅ DONE (Codex) | `pages/audio2/lipsync-model.ts` + `LipSyncStub.tsx`. Detects phonemes, outputs viseme keyframes. Could use Blender/Moho exporter UI as follow-up. |
| 3 | **In-browser voice recording booth + teleprompter** | ✅ DONE (Codex) | MediaRecorder wired, teleprompter auto-scrolls. |
| 4 | **Animated captions / VTT+SRT workflow** | ✅ DONE | Speech-to-Text via OpenAI Whisper UI is built, VTT/SRT export is fully functional. |
| 5 | **Branded client portal + structured approval rituals** | ✅ DONE (Antigravity) | E-sig canvas, branded client-facing review page with project colors. |
| 6 | **`.cel-archive` portable export (time capsule)** | ✅ DONE (Antigravity) | Zip: project JSON + assets + README. Portability layer complete. |
| 7 | **Continuity tracker + episode bible templates** | ✅ DONE (Codex) | `/projects/:id/bible` with character/prop/location/rule split, height extraction, lore-safe checker. |
| 8 | **Sprite-sheet auto-packer + GLTF/GLB export** | ✅ DONE (Antigravity) | PNG sheet packing + atlas JSON + minimal GLTF exporter implemented. |
| 9 | **Apple Pencil scratchpad + couch-mode swipe review** | ✅ DONE | `pages/scratchpad/` + `pages/couch-mode/` exist and are wired with Pointer Events and swipe gestures. |
| 10 | **Style/color palette matcher** — auto-extract palette from reference frame | ✅ DONE (Codex) | k-means in `palette-model.ts`, UI in `PaletteMatcher.tsx`.
| 11 | **Commission ROI + hours-per-frame heatmap** | ✅ DONE | Analytics page includes ROI per commission, task hours, and visual intensity indicators. |
| 12 | **Discord webhooks for project events** | ✅ DONE (Antigravity) | Trigger webhook on: animatic rendered, commission moved stage, asset approved, comment added. |

---

## Tier A — Big Wins

| # | Idea | Status | Notes |
|---|---|---|---|
| 13 | **Synchronized review room / dailies** — telestrator + live cursors | ✅ DONE (Codex) | `/projects/:id/review-room`, WebSocket-driven, presence + drawing canvas + shared playhead. Auth-checked via `canAccessProject`.
| 14 | **Auto-inbetweens + color flatting via AI** | ✅ DONE (Codex) | `/projects/:id/inbetween` with inbetween frame builder + flood-fill flatting.
| 15 | **Render budget burn-down + cost estimator** | ✅ DONE | Added GPU watts and $/kWh estimator panel to RenderBudget.tsx |
| 16 | **Branching "what-if" snapshots (Git-style)** | ✅ DONE | Snapshots UI exists and functions. |
| 17 | **Trash recovery + asset integrity checks** | ✅ DONE | Integrity scan loop is in `studio_routes.ts`, soft-delete works. |
| 18 | **Weekly challenge feed + reaction stickers** | ✅ DONE | Feed and sticker reactions are fully implemented in `pages/challenge/` and `challenge_routes.ts`. |
| 19 | **Procreate / Clip Studio / Figma watcher** | ✅ DONE | Drive watcher UI and sync polling logic added to AssetsTab. |
| 20 | **Daily sketch prompt + 12 principles drill deck** | ✅ DONE | Connected the dashboard UI to the daily-drills library. |
| 21 | **Auto credit roll builder + press kit generator** | ✅ DONE | CreditRoll + Press Kit PDF works, added PNG Sequence/Tall Roll export. |
| 22 | **Onboarding constellation + sandbox project** | ✅ DONE | Sandbox construction and feature map are wired in Dashboard. |

---

## Tier B — Solid additions

| # | Idea | Status | Notes |
|---|---|---|---|
| 23 | **Spring-loaded drag/drop physics + jelly progress bars** | ⬜ | Enhance UI interactions with spring physics |
| 24 | **Holographic achievement card flips** | 🟡 | Achievements DB exists, add the flip animation |
| 25 | **Custom workspace theme packs** | ⬜ | Allow users to create/install theme packs |
| 26 | **Seasonal UI easter eggs** | ⬜ | Halloween, holidays — auto by date |
| 27 | **Liquid Glass cursor physics + bouncing tooltips** | ⬜ | Aesthetic UI polish |
| 28 | **Sun-path illuminator + weather mood picker** | ⬜ | Adjust lighting/mood in the 3D scene preview |
| 29 | **Topographical terrain sketchpad** | ⬜ | Draw heightmaps, export to Blender |
| 30 | **HDRI location scouter** | ⬜ | Environment preview with HDRI spheres |
| 31 | **Animation state machine planner** | ⬜ | Gamedev crossover tool for mapping states |
| 32 | **Hitbox / hurtbox / event tagger** | ⬜ | Define hitboxes on sprite sheets |
| 33 | **Frame-rate quantizer** | ⬜ | Filter to step animation to a 12fps look |
| 34 | **"Adopt-a-prop" sponsorships + cameo auctions** | ⬜ | Crowdfunding elements |
| 35 | **Pay-what-you-want asset storefront + tip jar** | ⬜ | Monetization layer |
| 36 | **Bounty board for stuck problems** | ⬜ | Post a bounty for help with Blender/Moho |
| 37 | **After Effects `.jsx` bridge script** | ⬜ | Export Cel data to AE |

## Tier C — Performance & infrastructure

| # | Idea | Status | Notes |
|---|---|---|---|
| 38 | **WebCodecs hardware-accelerated video scrubbing** | ⬜ | Faster video playback performance |
| 39 | **CRDT-based offline sync (Yjs or Automerge)** | ⬜ | True offline-first multi-device sync |
| 40 | **Chunked resumable uploads (tus protocol)** | ⬜ | Reliable large file uploads |
| 41 | **WebAssembly waveform generation** | ⬜ | Faster audio waveform rendering |
| 42 | **Delta-compressed auto-saves** | ⬜ | Efficient save states |
| 43 | **Multi-threaded file hashing / dedup** | ⬜ | Asset deduplication |
| 44 | **Lazy-rendered virtualization** | ⬜ | react-window for long lists |
| 45 | **WebSocket delta event streaming** | ⬜ | Real-time updates without polling |

## Tier C — Accessibility (8)

| # | Idea | Status | Notes |
|---|---|---|---|
| 46 | **Focus mode (reduced-distraction UI)** | 🟡 | `a11y_routes.ts` exists |
| 47 | **OpenDyslexic font toggle** | 🟡 | Partial via a11y prefs |
| 48 | **Screen-reader alt text on storyboards** | ⬜ | ARIA integration |
| 49 | **Color-blind safe palette mode** | ⬜ | Adjusted UI and canvas overlays |
| 50 | **Full keyboard-only nav + aria audit** | ⬜ | Accessibility review |
| 51 | **Reduced-motion respect** | 🟡 | Partial implementation |
| 52 | **Large touch target mode** | ⬜ | Better tablet support |
| 53 | **Audio cues for completions/errors** | ⬜ | Sound design for UI events |

## Tier D — Business & distribution

| # | Idea | Status | Notes |
|---|---|---|---|
| 54 | **Festival submission tracker** | ⬜ | Track film festival entries |
| 55 | **Contracts & release forms library** | ⬜ | Boilerplate legal docs |
| 56 | **Model/talent release generator** | ⬜ | Auto-generate release forms |
| 57 | **Tax CSV export + 1099 helper** | ⬜ | Freelancer tax reporting |
| 58 | **Project-linked expense log** | ⬜ | Expense tracking |
| 59 | **Festival deliverables pre-flight check** | ⬜ | Validation for DCPs/ProRes exports |
| 60 | **Sponsorship pitch-deck exporter** | ⬜ | Generate PDFs for pitching |
| 61 | **Milestone payments with watermark unlock** | ⬜ | Escrow/payment gateway |

## Tier D — Audio depth

| # | Idea | Status | Notes |
|---|---|---|---|
| 62 | **Music stem separation** | ⬜ | Demucs in WebWorker or pre-rendered |
| 63 | **Audio-reactive cue markers on timeline** | ✅ DONE | CueMarkers UI added to Audio2 namespace |
| 64 | **Smart foley auto-tagging** | ⬜ | Tag sound effects automatically |
| 65 | **Ambient bed / room tone builder** | ⬜ | Soundscape generation |
| 66 | **One-click auto-mix & master** | ⬜ | Simple EQ/compression |
| 67 | **ADR punch-in loop mode** | ⬜ | Loop recording over video playback |

## Tier E — Worth tracking

- **Community & social:** profiles & showreels, public feeds, "in-the-studio" live, exquisite-corpse episodes, asset exchange/remix, breakdown blogs, peer review queue, follows feed
- **Bluey-specific:** vector brush presets, age-up/age-down sliders, game/imagination ruleset doc
- **Mobile/iPad:** voice memo feedback, AR reference projection, pencil hover/double-tap, gesture sorter, presentation mode, desk-to-couch handoff, live photo capture, tinder-style tagging
- **AI:** placeholder voice cloning, AI mentor, script-to-storyboard, animatic-to-3D blocking, dialogue ADR cleanup, render denoiser/upscaler
- **Educator:** "why does this work" annotated classics, structured skill trees, timing chart generator, glossary tooltips, fix-it sandbox
- **Geospatial:** location continuity tracker, satellite texture sampler, focal-length street view, geo-anchored soundscape, shadow-cast time-lapse
- **Onboarding:** speedrun shortcut game, contextual tooltips, role-based templates, did-you-know widget, progressive feature reveal, guided first-commission setup, "show me how" AI assistant, hover X-ray mode
- **Wildcards:** Bandit AI Roastmaster, Twitch-swarm render farm, haptic keyframe scrubbing, commission loot box delivery, webcam chaos mocap, lucid-dream dictation node, client mind-reader heatmaps, time-travel style predictor
- **Studio pro extras:** asset revision tree, one-click shot turnover, asset casting matrix, node-based pipeline dep viewer, color script timeline, environment state tracker, freelancer bid packager, complexity quota heatmap, final spec validator
- **Backup extras:** cloud sync, render-output redundancy cold storage, zero-knowledge encrypted backups, deep-freeze read-only, incremental DB snapshots
- **Client extras:** interactive onboarding walkthrough, guided feedback rubric, delivery confetti + NPS, secure watermarked previews, milestone widget, curated style selector, weekly digest email
- **Integrations extras:** Google Drive / Dropbox sync, Notion import, OBS scene switcher, Zapier/Make webhooks, Cara/Behance/ArtStation publisher

---

## Cross-angle convergence — ⭐ multi-agent picks

Five+ agents independently proposed these, so weight them higher:

1. **Real-time multiplayer review** (Studio + Community + Wildcard + Client) — Tier A #13
2. **Version-compare / side-by-side** (Client + Educator + Backup) — Tier S #1
3. **Phoneme lip-sync** (Audio + AI) — Tier S #2
4. **Continuity tracking** (Studio + Bluey + Geospatial) — Tier S #7
5. **Export portability** (Backup + Festival + Gamedev) — Tier S #6
6. **AI mentor / critique** (Educator + AI + Wildcard)
7. **Discord-style webhooks** (Integrations + Community + Studio) — Tier S #12

---

## Suggested first batch for Codex (low risk, high value)

These are good warm-up tickets — small surface, high user value, low chance of breaking the publish flow:

1. **#12 Discord webhooks** — `server/discord.ts` is wired. Just add the trigger calls in route handlers (after animatic export, commission status change). Settings page input for webhook URL. Test with a fake webhook.
2. **#7 Episode bible UI** — `server/lor_routes.ts` + template exist. Build a React form-driven view at `/projects/:id/bible` with character height grid, location list, props.
3. **#5 Approval buttons** — `server/approval_routes.ts` exists. Add "Approve Sketch" / "Approve Final" with timestamped e-sig in the share/review page.
4. **#11 Hours-per-frame heatmap** — `pages/analytics/` exists. Add a time-tracking table per task + a simple SVG heatmap (hours ÷ frames).
5. **#20 Daily prompt + 12 principles** — Static JSON of 365 prompts + 12 principle cards. Add to Dashboard sidebar.

Avoid anything that:
- Adds new npm dependencies (bundle is already 1.4 MB)
- Touches `App.tsx` routing in a way that re-enables liquidGL
- Adds `localStorage` / `sessionStorage` (sandbox blocks them)
- Bypasses `requireAuth` on user-scoped routes

---

## How to hand work back to Matthew

When Codex finishes a feature:

1. `npm run build` succeeds, no new warnings
2. Tested in light + dark mode, 1440×900 + 375×667
3. Tested with `node dist/index.cjs` locally at http://localhost:5000
4. Updated `CODEX_BACKLOG.md` to flip ⬜ → ✅
5. Hand the changed files (or a zip / diff) back to Matthew
6. Matthew's main agent rebuilds → `deploy_website` → `publish_website` with site_id `4f19eb19-3340-436c-841e-3bf6d1494df1`
