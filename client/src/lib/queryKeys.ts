/** Canonical React Query key factories — keep in sync with API route shapes. */
export const queryKeys = {
  projects: () => ["/api/projects"] as const,
  project: (id: number) => ["/api/projects", id] as const,
  storyboards: (projectId: number) => ["/api/projects", projectId, "storyboards"] as const,
  scenes: (projectId: number) => ["/api/projects", projectId, "scenes"] as const,
  scripts: (projectId: number) => ["/api/projects", projectId, "scripts"] as const,
  animatics: (projectId: number) => ["/api/projects", projectId, "animatics"] as const,
  animaticsV2: (projectId: number) => ["/api/projects", projectId, "animatics-v2"] as const,
  comments: (projectId: number) => ["/api/projects", projectId, "comments"] as const,
  aiKey: (projectId: number) => ["/api/projects", projectId, "ai", "key"] as const,
  aiSessions: (projectId: number) => ["/api/projects", projectId, "ai", "sessions"] as const,
  aiSessionMessages: (projectId: number, sessionId: number) =>
    ["/api/projects", projectId, "ai", "sessions", sessionId, "messages"] as const,
  sceneRenders: (sceneId: number) => ["/api/scenes", sceneId, "renders"] as const,
  sceneTimers: (projectId: number) => ["/api/projects", projectId, "scene-timers"] as const,
  storyboardPins: (storyboardId: number) => ["/api/storyboards", storyboardId, "pins"] as const,
  assets: (projectId: number, category?: string) =>
    ["/api/projects", projectId, "assets", category ?? "all"] as const,
};