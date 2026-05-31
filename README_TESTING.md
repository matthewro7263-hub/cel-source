# Ticket 1 — Challenge Leaderboard: Testing Guide

## Prerequisites

- Dev server running (`npm run dev`)
- At least one row in `challenge_prompts` (seeded automatically)
- At least one registered user with a valid Bearer token

---

## 1. Run the Migration

```bash
npx drizzle-kit push
# or manually:
psql $DATABASE_URL -f migrations/0010_challenge_leaderboard_snapshots.sql
```

Verify the table exists:
```sql
\d challenge_leaderboard_snapshots
```

---

## 2. Seed a Week's Submissions and Reactions

```bash
TOKEN="<your_bearer_token>"
WEEK=20

# Create a submission
curl -s -X POST http://localhost:5000/api/challenges/submissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"promptId":1,"imageUrl":"https://placekitten.com/400/300","notes":"Test"}' | jq .

# Add a reaction
SUBMISSION_ID=1
curl -s -X POST http://localhost:5000/api/challenges/submissions/$SUBMISSION_ID/reactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sticker":"spark"}' | jq .
```

---

## 3. Live Leaderboard (public — no auth needed)

```bash
curl -s "http://localhost:5000/api/challenges/leaderboard?week=$WEEK&limit=10" | jq .
```

Expected: array sorted by `totalReactions` desc, each item has
`{ submissionId, userId, imageUrl, notes, totalReactions }`.

Empty week returns `[]` (not 500):
```bash
curl -s "http://localhost:5000/api/challenges/leaderboard?week=999" | jq .
# -> []
```

Invalid param returns 400:
```bash
curl -s "http://localhost:5000/api/challenges/leaderboard?week=abc" | jq .
# -> { "message": "week must be a positive integer" }
```

---

## 4. Manual Snapshot Trigger (requires auth)

```bash
curl -s -X POST http://localhost:5000/api/challenges/leaderboard/snapshot \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"week\": $WEEK}" | jq .
# -> { "ok": true, "week": 20, "rows": 1 }
```

Verify the row was written:
```sql
SELECT * FROM challenge_leaderboard_snapshots WHERE week_number = 20 ORDER BY rank;
```

---

## 5. Snapshot Read (public — no auth needed)

```bash
curl -s "http://localhost:5000/api/challenges/leaderboard/snapshot?week=$WEEK" | jq .
```

Expected: same shape as live, but sourced from the snapshot table.
Empty week returns `[]`.

---

## 6. UI Smoke Test

1. Open `/challenge` in the browser
2. The **Week N Leaderboard** card renders below the prompt cards
3. The **LIVE** badge is visible
4. Add a reaction to any submission — the reaction count updates in the feed
   AND the leaderboard row updates within ~60 seconds (auto-refresh interval)
5. Ranks 1–3 show medals; rank 4+ shows `#N`

---

## 7. Regression Checklist

| Endpoint | Expected |
|---|---|
| `GET /api/challenges/prompts` | unchanged |
| `GET /api/challenges/submissions` | unchanged |
| `GET /api/challenges/feed` | unchanged |
| `POST /api/challenges/submissions` | unchanged |
| `POST /api/challenges/submissions/:id/reactions` | unchanged |
| `GET /api/challenges/leaderboard?week=N` | **NEW** — 200 |
| `GET /api/challenges/leaderboard/snapshot?week=N` | **NEW** — 200 |
| `POST /api/challenges/leaderboard/snapshot` | **NEW** — 200 (authed) / 401 (unauthed) |
