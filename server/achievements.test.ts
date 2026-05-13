import assert from "node:assert/strict";
import { getAchievementDef, ACHIEVEMENT_DEFS } from "./achievements.ts";

// Happy path: Retrieve a valid achievement
const firstProject = getAchievementDef("first_project");
assert.ok(firstProject);
assert.equal(firstProject?.name, "First steps");
assert.equal(firstProject?.code, "first_project");
assert.equal(firstProject?.icon, "FolderOpen");

// Happy path: Retrieve another valid achievement
const weekStreak = getAchievementDef("week_streak");
assert.ok(weekStreak);
assert.equal(weekStreak?.name, "Consistent");
assert.equal(weekStreak?.code, "week_streak");

// Negative path: Retrieve an invalid achievement
const invalidAchievement = getAchievementDef("non_existent_achievement");
assert.equal(invalidAchievement, undefined);

// Edge case: empty string
const emptyAchievement = getAchievementDef("");
assert.equal(emptyAchievement, undefined);

// Edge case: undefined/null cast
const nullAchievement = getAchievementDef(null as any);
assert.equal(nullAchievement, undefined);

console.log("server/achievements tests passed");
