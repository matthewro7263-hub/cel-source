import type { Express } from "express";

const ID_PARAMS = [
  "id", "sbId", "projectId", "sceneId", "scriptId", "snapId", "panelId", "commentId",
  "entryId", "eventId", "aId", "versionId", "userId", "soundId", "sessionId",
];

/** Reject non-numeric id route params with 400 (otherwise NaN reaches the DB and surfaces as a 500). */
export function registerIdParamValidators(app: Express) {
  for (const name of ID_PARAMS) {
    app.param(name, (_req, res, next, value) => {
      if (!/^\d{1,10}$/.test(String(value))) return res.status(400).json({ message: `Invalid ${name}` });
      next();
    });
  }
}
