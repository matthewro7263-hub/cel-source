// ─────────────────────────────────────────────────────────────────────────────
// PATCH: add the following imports to the TOP of server/storage.ts
// ─────────────────────────────────────────────────────────────────────────────
//
//   import * as leaderboardSchema from "@shared/challenge_leaderboard_schema";
//
// Then add "...leaderboardSchema" to the schema spread:
//
//   const schema = {
//     ...mainSchema,
//     ...a11ySchema,
//     ...challengeSchema,
//     ...lorSchema,
//     ...studioSchema,
//     ...leaderboardSchema,   // ← ADD THIS LINE
//   };
//
// No storage methods are needed for the leaderboard — all DB access is done
// directly in leaderboard_cron.ts and challenge_routes.ts using the `db`
// instance that is already exported from storage.ts.
// ─────────────────────────────────────────────────────────────────────────────
