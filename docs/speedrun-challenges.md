# Speedrun Challenges

A **speedrun challenge** is a time-limited variant of the existing weekly challenge. Submissions are only accepted while the countdown window is open.

## How to test locally

### 1. Apply the migration

```bash
# Option A — Drizzle push (dev only)
pnpm drizzle-kit push

# Option B — raw SQL
psql $DATABASE_URL -f migrations/0010_speedrun_challenges.sql
```

### 2. Seed a speedrun prompt

Open a REPL or a quick script:

```bash
curl -X POST http://localhost:5173/api/challenges/prompts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-session-token>" \
  -d '{
    "weekNumber": 99,
    "title": "48-Hour Speedrun: Background Painting",
    "body": "Paint one background scene in under 48 hours.",
    "isSpeedrun": true,
    "deadlineHours": 48
  }'
```

To test the **expired** path immediately, set `deadlineHours: 0` or a value in the past via SQL:

```sql
UPDATE challenge_prompts
SET deadline_hours = 0
WHERE is_speedrun = TRUE;
```

### 3. What to verify in the UI

| Scenario | Expected behaviour |
|---|---|
| Window open, not submitted | `⚡ Speedrun` badge + live countdown + participant count |
| Countdown < 1 hour | Timer turns amber |
| Window expired | Timer shows "Window closed" in red; submit button disabled |
| Submit while expired | Server returns `409 { message: "Speedrun window closed" }` |
| Normal prompt | No badge, no countdown — visually identical to before |

### 4. Participant polling

The participant count badge polls `GET /api/challenges/prompts/:id/participants` every **30 seconds**. Open two browser tabs logged in as different users and submit from one — the other tab's count updates within 30 s.

### 5. Run the tests

```bash
bun test
pnpm check   # TypeScript
```

No new test file is required for this ticket — the existing `challenge_routes` coverage is sufficient, and the `SpeedrunCountdown` component is pure UI with no external dependencies.
