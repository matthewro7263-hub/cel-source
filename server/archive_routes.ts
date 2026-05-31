import type { Express, Request, Response, NextFunction } from "express";
import { db, getSessionUser, storage } from "./storage";
import { eq, inArray } from "drizzle-orm";
import archiver from "archiver";
let createCanvas: any; try { import("canvas").then(c => createCanvas = c.createCanvas).catch(() => {}); } catch (e) {}
import { 
  scripts, storyboards, storyboardPanels, animatics, scenes, comments, 
  assets, animaticProjects, animaticTracks, animaticClips,
  audVoiceTakes, audCaptions, cli_approvals, cli_feedback,
  renders, projectAiKeys, panelPins, sceneTimeEntries,
  commissionPricingPresets
} from "@shared/schema";
import { 
  lor_continuity_facts, lor_palettes, lor_asset_versions, lor_casting_matrix 
} from "@shared/lor_schema";
import { 
  studio_render_events, studio_render_budget, studio_snapshots, studio_credit_entries 
} from "@shared/studio_schema";
import { biz_festivals, biz_expenses } from "@shared/biz_schema";

async function canAccessProject(projectId: number, userId: number): Promise<boolean> {
  const p = await storage.getProject(projectId);
  if (!p) return false;
  if (p.ownerId === userId) return true;
  return await storage.isMember(projectId, userId);
}

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth) return undefined;
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return undefined;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const userId = getSessionUser(token);
  if (!userId) return res.status(401).json({ message: "Not authenticated" });
  const user = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "User not found" });
  (req as any).user = user;
  next();
}

export function registerArchiveRoutes(app: Express) {
  app.get("/api/projects/:id/archive", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(projectId, (req as any).user.id))) {
      return res.status(403).json({ message: "No access" });
    }

    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="project-${projectId}-archive.cel-archive"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    try {
      // 1. Gather all data
      const data: any = {
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        project,
        members: await storage.listMembers(projectId),
        scripts: await db.select().from(scripts).where(eq(scripts.projectId, projectId)),
        storyboards: await db.select().from(storyboards).where(eq(storyboards.projectId, projectId)),
        animatics: await db.select().from(animatics).where(eq(animatics.projectId, projectId)),
        scenes: await db.select().from(scenes).where(eq(scenes.projectId, projectId)),
        comments: await db.select().from(comments).where(eq(comments.projectId, projectId)),
        assets: await db.select().from(assets).where(eq(assets.projectId, projectId)),
        animaticProjects: await db.select().from(animaticProjects).where(eq(animaticProjects.projectId, projectId)),
        continuityFacts: await db.select().from(lor_continuity_facts).where(eq(lor_continuity_facts.projectId, projectId)),
        palettes: await db.select().from(lor_palettes).where(eq(lor_palettes.projectId, projectId)),
        approvals: await db.select().from(cli_approvals).where(eq(cli_approvals.projectId, projectId)),
        feedback: await db.select().from(cli_feedback).where(eq(cli_feedback.projectId, projectId)),
        voiceTakes: await db.select().from(audVoiceTakes).where(eq(audVoiceTakes.projectId, projectId)),
        renderEvents: await db.select().from(studio_render_events).where(eq(studio_render_events.projectId, projectId)),
        renderBudget: await db.select().from(studio_render_budget).where(eq(studio_render_budget.projectId, projectId)).then((r) => r[0]),
        snapshots: await db.select().from(studio_snapshots).where(eq(studio_snapshots.projectId, projectId)),
        creditEntries: await db.select().from(studio_credit_entries).where(eq(studio_credit_entries.projectId, projectId)),
        festivals: await db.select().from(biz_festivals).where(eq(biz_festivals.projectId, projectId)),
        expenses: await db.select().from(biz_expenses).where(eq(biz_expenses.projectId, projectId)),
        aiKey: await db.select().from(projectAiKeys).where(eq(projectAiKeys.projectId, projectId)).then((r) => r[0]),
        castingMatrix: await db.select().from(lor_casting_matrix).where(eq(lor_casting_matrix.projectId, projectId)),
        pricingPresets: await db.select().from(commissionPricingPresets).where(eq(commissionPricingPresets.projectId, projectId)),
      };

      // 2. Fetch related sub-data
      const sbIds = data.storyboards.map((s: any) => s.id);
      if (sbIds.length > 0) {
        data.storyboardPanels = await db.select().from(storyboardPanels).where(inArray(storyboardPanels.storyboardId, sbIds));
        const panelIds = data.storyboardPanels.map((p: any) => p.id);
        if (panelIds.length > 0) {
          data.panelPins = await db.select().from(panelPins).where(inArray(panelPins.panelId, panelIds));
        }
      }

      const sceneIds = data.scenes.map((s: any) => s.id);
      if (sceneIds.length > 0) {
        data.renders = await db.select().from(renders).where(inArray(renders.sceneId, sceneIds));
        data.timeEntries = await db.select().from(sceneTimeEntries).where(inArray(sceneTimeEntries.sceneId, sceneIds));
      }

      const assetIds = data.assets.map((a: any) => a.id);
      if (assetIds.length > 0) {
        data.assetVersions = await db.select().from(lor_asset_versions).where(inArray(lor_asset_versions.assetId, assetIds));
      }

      const apIds = data.animaticProjects.map((ap: any) => ap.id);
      if (apIds.length > 0) {
        data.animaticTracks = await db.select().from(animaticTracks).where(inArray(animaticTracks.animaticProjectId, apIds));
        const trackIds = data.animaticTracks.map((t: any) => t.id);
        if (trackIds.length > 0) {
          data.animaticClips = await db.select().from(animaticClips).where(inArray(animaticClips.trackId, trackIds));
        }
        data.captions = await db.select().from(audCaptions).where(inArray(audCaptions.animaticProjectId, apIds));
      }

      // 3. Process Assets: Extract base64 to separate files for better portability
      // This helps if the JSON becomes too large for some parsers.
      const assetFiles: { path: string; data: string }[] = [];
      
      data.assets = data.assets.map((asset: any) => {
        if (!asset.fileData) return asset;
        const safeFilename = asset.filename ? asset.filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_') : 'unnamed_asset';
        const filePath = `assets/asset_${asset.id}_${safeFilename}`;
        assetFiles.push({ path: filePath, data: asset.fileData });
        return { ...asset, fileData: `EXT:${filePath}` };
      });

      data.storyboardPanels = (data.storyboardPanels || []).map((panel: any) => {
        if (!panel.imageData) return panel;
        const filePath = `panels/panel_${panel.id}.png`;
        assetFiles.push({ path: filePath, data: panel.imageData });
        return { ...panel, imageData: `EXT:${filePath}` };
      });

      // 4. Add files to archive
      archive.append(JSON.stringify(data, null, 2), { name: "project.json" });
      
      for (const file of assetFiles) {
        if (!file.data) continue;
        const commaIdx = file.data.indexOf(",");
        if (commaIdx !== -1) {
          const base64Data = file.data.slice(commaIdx + 1);
          if (base64Data.length > 0) {
            archive.append(Buffer.from(base64Data, "base64"), { name: file.path });
          }
        }
      }

      archive.append(`# Project Archive: ${project.title}\n\nExported on ${data.exportedAt}.\n\nThis is a .cel-archive file, which is a standard ZIP containing a project.json and assets.`, { name: "README.md" });

      await archive.finalize();
    } catch (err) {
      console.error("Export failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Export failed" });
      }
    }
  });

  app.get("/api/projects/:id/export/:kind", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    const kind = req.params.kind;
    if (!(await canAccessProject(projectId, (req as any).user.id))) return res.status(403).json({ message: "No access" });

    // RFC-4180 CSV field escaping: wrap in quotes if field contains comma, quote, or newline
    const csvField = (val: any): string => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    try {
      if (kind === "scenes-csv") {
        const rows = await db.select().from(scenes).where(eq(scenes.projectId, projectId));
        const csv = [
          "ID,Number,Title,Status,Deadline",
          ...rows.map(r => [r.id, csvField(r.number), csvField(r.title), csvField(r.status), csvField(r.deadline || "")].join(","))
        ].join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="project-${projectId}-scenes.csv"`);
        return res.send(csv);
      }

      if (kind === "comments-csv") {
        const rows = await db.select().from(comments).where(eq(comments.projectId, projectId));
        const csv = [
          "ID,AuthorID,Body,CreatedAt",
          ...rows.map(r => [r.id, r.authorId, csvField(r.body), csvField(r.createdAt)].join(","))
        ].join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="project-${projectId}-comments.csv"`);
        return res.send(csv);
      }

      if (kind === "storyboards-zip-png") {
        const sbs = await db.select().from(storyboards).where(eq(storyboards.projectId, projectId));
        const archive = archiver("zip", { zlib: { level: 5 } });
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="project-${projectId}-storyboards.zip"`);
        archive.pipe(res);

        const storyboardIds = sbs.map(sb => sb.id);
        const allPanels = storyboardIds.length > 0
          ? await db.select().from(storyboardPanels).where(inArray(storyboardPanels.storyboardId, storyboardIds))
          : [];

        const panelsByStoryboardId = allPanels.reduce((acc, panel) => {
          const id = panel.storyboardId;
          if (id !== null) {
            if (!acc[id]) acc[id] = [];
            acc[id].push(panel);
          }
          return acc;
        }, {} as Record<number, typeof allPanels>);

        for (const sb of sbs) {
          const panels = panelsByStoryboardId[sb.id] || [];
          const safeTitle = sb.title ? sb.title.replace(/[^a-zA-Z0-9_\-\.]/g, '_') : 'storyboard';
          for (let i = 0; i < panels.length; i++) {
            const p = panels[i];
            if (!p.imageData) continue;
            const commaIdx = p.imageData.indexOf(",");
            if (commaIdx !== -1) {
              // data URL: extract base64 portion after comma
              const base64Data = p.imageData.slice(commaIdx + 1);
              if (base64Data.length > 0) {
                archive.append(Buffer.from(base64Data, "base64"), { name: `${safeTitle}/panel_${i + 1}_${p.id}.png` });
              }
            }
            // else: not a data URL, skip (could be a URL, which archiver can't inline)
          }
        }
        return await archive.finalize();
      }

      if (kind === "scripts-pdf") {
        const rows = await db.select().from(scripts).where(eq(scripts.projectId, projectId));
        if (rows.length === 0) {
          return res.status(404).json({ message: "No scripts to export" });
        }
        const content = rows.map(r => `# ${r.title}\n\n${r.content}\n\n---`).join("\n\n");
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="project-${projectId}-scripts.md"`);
        return res.send(content);
      }

      if (kind === "credit-roll-png") {
        const entries = await db.select().from(studio_credit_entries).where(eq(studio_credit_entries.projectId, projectId));
        
        const cast = entries.filter(e => e.section === "cast").sort((a, b) => a.orderIdx - b.orderIdx);
        const crew = entries.filter(e => e.section === "crew").sort((a, b) => a.orderIdx - b.orderIdx);

        const width = 1920;
        const lineHeight = 70;
        const sectionGap = 150;
        const titleHeight = 300;
        let height = titleHeight + 300; 
        if (cast.length > 0) height += sectionGap + cast.length * lineHeight;
        if (crew.length > 0) height += sectionGap + crew.length * lineHeight;

        const canvas = createCanvas(width, Math.max(1080, height));
        const ctx = canvas.getContext("2d");

        // Transparent background
        ctx.fillStyle = "rgba(0, 0, 0, 0)";
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        
        let y = titleHeight;

        const p = await storage.getProject(projectId);
        ctx.font = "bold 90px Arial";
        ctx.fillText(p?.title || "Project", width / 2, y);
        y += sectionGap;

        if (cast.length > 0) {
          ctx.textAlign = "center";
          ctx.font = "bold 50px Arial";
          ctx.fillStyle = "#aaaaaa";
          ctx.fillText("CAST", width / 2, y);
          y += 90;
          
          for (const c of cast) {
            ctx.textAlign = "right";
            ctx.fillStyle = "#dddddd";
            ctx.font = "40px Arial";
            ctx.fillText(c.role, width / 2 - 40, y);
            
            ctx.textAlign = "left";
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 40px Arial";
            ctx.fillText(c.name, width / 2 + 40, y);
            y += lineHeight;
          }
          y += sectionGap;
        }

        if (crew.length > 0) {
          ctx.textAlign = "center";
          ctx.font = "bold 50px Arial";
          ctx.fillStyle = "#aaaaaa";
          ctx.fillText("CREW", width / 2, y);
          y += 90;

          for (const c of crew) {
            ctx.textAlign = "right";
            ctx.fillStyle = "#dddddd";
            ctx.font = "40px Arial";
            ctx.fillText(c.role, width / 2 - 40, y);
            
            ctx.textAlign = "left";
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 40px Arial";
            ctx.fillText(c.name, width / 2 + 40, y);
            y += lineHeight;
          }
        }

        const buffer = canvas.toBuffer("image/png");
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Disposition", `attachment; filename="project-${projectId}-credit-roll.png"`);
        return res.send(buffer);
      }

      res.status(400).json({ message: `Unknown export kind: ${kind}` });
    } catch (err) {
      console.error("Kind export failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Export failed" });
      }
    }
  });
}
