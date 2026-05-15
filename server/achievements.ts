// server/achievements.ts — v4 Achievements
// Auto-unlock logic for the Cel achievements system.

export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { code: "first_project",    name: "First steps",       description: "Created your first project",            icon: "FolderOpen" },
  { code: "first_scene",      name: "Storyteller",       description: "Added your first scene",                icon: "Film" },
  { code: "first_storyboard", name: "Visual thinker",    description: "Uploaded your first storyboard",        icon: "Image" },
  { code: "ten_panels",       name: "Page turner",       description: "Added 10 storyboard panels",            icon: "LayoutGrid" },
  { code: "fifty_panels",     name: "Pen pusher",        description: "Added 50 storyboard panels",            icon: "Star" },
  { code: "hundred_panels",   name: "Centurion",         description: "Added 100 storyboard panels",           icon: "Crown" },
  { code: "first_animatic",   name: "Moving pictures",   description: "Created your first animatic",           icon: "Clapperboard" },
  { code: "first_commission", name: "Going pro",         description: "Received your first commission",        icon: "DollarSign" },
  { code: "first_delivered",  name: "First payday",      description: "Delivered a commission",                icon: "Award" },
  { code: "night_owl",        name: "Midnight oil",      description: "Worked between midnight and 5am",       icon: "Moon" },
  { code: "early_bird",       name: "Early bird",        description: "Worked between 5am and 7am",            icon: "Sun" },
  { code: "week_streak",      name: "Consistent",        description: "Used Cel 7 days in a row",              icon: "Flame" },
  { code: "share_link",       name: "Showing off",       description: "Enabled a public share link",           icon: "Share2" },
  { code: "team_player",      name: "Better together",   description: "Added a teammate to a project",         icon: "Users" },
  { code: "polished",         name: "Picky",             description: "Added 20 comments",                     icon: "MessageSquare" },
];

export function getAchievementDef(code: string): AchievementDef | undefined {
  return ACHIEVEMENT_DEFS.find((a) => a.code === code);
}

/**
 * Check and unlock achievements based on context.
 * Returns array of newly unlocked achievement codes.
 */
import { storage } from "./storage";

interface AchievementContext {
  userId: number;
  event:
    | "create_project"
    | "create_scene"
    | "create_panel"
    | "create_animatic"
    | "create_commission"
    | "deliver_commission"
    | "enable_share_link"
    | "add_member"
    | "create_comment"
    | "login";
  projectId?: number;
}

export async function checkAchievements(ctx: AchievementContext): Promise<string[]> {
  const { userId, event } = ctx;
  const unlocked: string[] = [];

  async function tryUnlock(code: string) {
    if (!await (storage as any).hasAchievement(userId, code)) {
      await (storage as any).unlockAchievement(userId, code);
      unlocked.push(code);
    }
  }

  // Time-based achievements
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 5) await tryUnlock("night_owl");
  if (hour >= 5 && hour < 7) await tryUnlock("early_bird");

  switch (event) {
    case "create_project": {
      const projectsList = await storage.listProjectsForUser(userId);
      if (projectsList.length >= 1) await tryUnlock("first_project");
      break;
    }
    case "create_scene": {
      const userProjects = await storage.listProjectsForUser(userId);
      let totalScenes = 0;
      for (const p of userProjects) {
        totalScenes += (await storage.listScenes(p.id)).length;
      }
      if (totalScenes >= 1) await tryUnlock("first_scene");
      break;
    }
    case "create_panel": {
      await tryUnlock("first_storyboard");
      const userProjects = await storage.listProjectsForUser(userId);
      let totalPanels = 0;
      for (const p of userProjects) {
        const sbs = await storage.listStoryboards(p.id);
        for (const sb of sbs) {
          totalPanels += (await storage.listPanels(sb.id)).length;
        }
      }
      if (totalPanels >= 10) await tryUnlock("ten_panels");
      if (totalPanels >= 50) await tryUnlock("fifty_panels");
      if (totalPanels >= 100) await tryUnlock("hundred_panels");
      break;
    }
    case "create_animatic": {
      await tryUnlock("first_animatic");
      break;
    }
    case "create_commission": {
      await tryUnlock("first_commission");
      break;
    }
    case "deliver_commission": {
      await tryUnlock("first_delivered");
      break;
    }
    case "enable_share_link": {
      await tryUnlock("share_link");
      break;
    }
    case "add_member": {
      await tryUnlock("team_player");
      break;
    }
    case "create_comment": {
      const userProjects = await storage.listProjectsForUser(userId);
      let totalComments = 0;
      for (const p of userProjects) {
        totalComments += (await storage.listComments(p.id)).length;
      }
      if (totalComments >= 20) await tryUnlock("polished");
      break;
    }
    case "login": {
      const dates = await (storage as any).getAchievementUnlockDates?.(userId) ?? [];
      const activityDays: Set<string> = new Set(
        dates.map((d: string) => new Date(d).toDateString())
      );
      if (activityDays.size >= 7) await tryUnlock("week_streak");
      break;
    }
  }

  return unlocked;
}
