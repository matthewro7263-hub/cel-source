# CEL-MON-002 — Watermark Upsell: Testing Guide

## Overview

This feature adds a one-time $9 payment to remove the `PREVIEW` watermark from a
project's public share links. It touches:

| Layer | File |
|---|---|
| DB schema | `shared/schema.ts` (2 new columns on `projects`) |
| Migration | `drizzle/migrations/0010_watermark_upsell.sql` |
| Overlay guard | `client/src/components/cli-watermark.tsx` |
| Owner banner | `client/src/components/AmberOwnerBanner.tsx` |
| Backend routes | `server/routes/watermark.ts` |
| Server registration | `server/index.ts` |

---

## 1. Run the migration

```bash
# If using Drizzle Kit:
npx drizzle-kit migrate

# Or apply manually against Neon Postgres:
psql $DATABASE_URL -f drizzle/migrations/0010_watermark_upsell.sql
```

---

## 2. Required environment variables

Add to `.env` (or Render/Vercel dashboard):

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=https://your-app-url.com        # used for Checkout success/cancel URLs
```

---

## 3. Stripe CLI local webhook forwarding

```bash
stripe listen --forward-to localhost:5000/api/stripe/webhooks
```

Copy the `whsec_...` value printed to `STRIPE_WEBHOOK_SECRET`.

---

## 4. Happy-path test

1. Create or pick a project. Enable **Share Link** in project settings.
2. Open the project dashboard. The **amber banner** should appear:
   > "Your shared links show a PREVIEW watermark. Remove it once for $9."
3. Click **Remove Watermark** → redirects to Stripe Checkout.
4. Use test card `4242 4242 4242 4242`, any future expiry, any CVC.
5. Stripe fires `checkout.session.completed` → webhook sets `watermark_removed = true`.
6. You are redirected to `/#/projects/:id?watermark_success=1`.
7. Open the public share link (`/s/:token`).
   - **Before payment**: `PREVIEW · Project Name` diagonal watermark is visible.
   - **After payment**: watermark is gone entirely.

---

## 5. Webhook signature verification test

Send a tampered payload; the server must respond `400`:

```bash
curl -X POST http://localhost:5000/api/stripe/webhooks \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=1,v1=badhex" \
  -d '{"type":"checkout.session.completed"}'
# Expected: 400 {"message":"Webhook signature verification failed"}
```

---

## 6. Owner-view overlay suppression

The `ownerView` prop on `<CliWatermarkOverlay>` prevents the watermark from
appearing when the project owner views their own storyboard panels inside
`ProjectWorkspace`. Pass `ownerView={true}` wherever the owner is the viewer:

```tsx
<CliWatermarkOverlay
  projectId={project.id}
  projectName={project.title}
  ownerView={true}   // ← suppresses overlay in workspace
/>
```

---

## 7. AmberOwnerBanner placement

Render the banner near the top of the project workspace or dashboard card:

```tsx
import { AmberOwnerBanner } from "@/components/AmberOwnerBanner";

// Inside ProjectWorkspace, after project loads:
{project.ownerId === currentUser.id && project.shareEnabled && (
  <AmberOwnerBanner
    projectId={project.id}
    watermarkRemoved={(project as any).watermarkRemoved ?? false}
  />
)}
```

---

## 8. Edge cases

| Scenario | Expected behaviour |
|---|---|
| Payment already done | `POST /checkout` returns `400 "Watermark is already removed"` |
| Missing `STRIPE_SECRET_KEY` | `503 "STRIPE_SECRET_KEY env var is not set"` |
| Missing `STRIPE_WEBHOOK_SECRET` | Webhook endpoint returns `500` and logs error |
| Non-owner calls `/checkout` | `403 "Only the project owner can do this"` |
| Unauthenticated call | `401 "Not authenticated"` |
| `watermark_removed = true` in DB | Overlay returns `null`; banner hidden |
