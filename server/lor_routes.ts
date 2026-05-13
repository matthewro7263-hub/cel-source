import type { Express, Request, Response, NextFunction } from "express";
import { getSessionUser, storage } from "./storage";
import { LOR_EPISODE_BIBLE_SEED } from "./templates/lor_episode_bible";
import { z } from "zod";
import { notifyDiscord } from "./discord";

function canAccessProject(projectId: number, userId: number): boolean {
  const p = storage.getProject(projectId);
  if (!p) return false;
  if (p.ownerId === userId) return true;
  return storage.isMember(projectId, userId);
}

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth) return undefined;
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return undefined;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const userId = getSessionUser(token);
  if (!userId) return res.status(401).json({ message: "Not authenticated" });
  const user = storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "User not found" });
  (req as any).user = user;
  next();
}

export function registerLorRoutes(app: Express) {
  // Zod schema for lor_facts PUT (only allow safe fields)
  const lorFactPutSchema = z.object({
    category: z.string().optional(),
    title: z.string().optional(),
    body: z.string().optional(),
    imageData: z.string().nullable().optional(),
  });

  // 1. Continuity Tracker Routes
  app.get("/api/projects/:id/lor_facts", requireAuth, (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    if (!canAccessProject(projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    const facts = storage.listLorFacts(projectId);
    res.json(facts);
  });

  app.post("/api/projects/:id/lor_facts", requireAuth, (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    if (!canAccessProject(projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    const fact = storage.createLorFact({
      projectId,
      category: req.body.category || 'character',
      title: req.body.title,
      body: req.body.body || '',
      imageData: req.body.imageData || null,
    });
    res.json(fact);
  });

  app.put("/api/lor_facts/:id", requireAuth, (req, res) => {
    const factId = parseInt(String(req.params.id), 10);
    const row = storage.getLorFact(factId);
    if (!row) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(row.projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    let patch: any;
    try { patch = lorFactPutSchema.parse(req.body); } catch (e: any) { return res.status(400).json({ message: e.message }); }
    const fact = storage.updateLorFact(factId, patch);
    res.json(fact);
  });

  app.delete("/api/lor_facts/:id", requireAuth, (req, res) => {
    const factId = parseInt(String(req.params.id), 10);
    const row = storage.getLorFact(factId);
    if (!row) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(row.projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    storage.deleteLorFact(factId);
    res.json({ success: true });
  });

  // 2. Episode Bible Template route
  app.post("/api/projects/:id/lor_seed_bible", requireAuth, (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    if (!canAccessProject(projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    for (const item of LOR_EPISODE_BIBLE_SEED) {
      storage.createLorFact({
        projectId,
        ...item as any,
      });
    }
    res.json({ success: true });
  });

  // 3. Color Palette Matcher routes
  app.get("/api/projects/:id/lor_palettes", requireAuth, (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    if (!canAccessProject(projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    const palettes = storage.listLorPalettes(projectId);
    res.json(palettes);
  });

  app.post("/api/projects/:id/lor_palettes", requireAuth, (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    if (!canAccessProject(projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    const palette = storage.createLorPalette({
      projectId,
      name: req.body.name || 'Palette',
      colors: JSON.stringify(req.body.colors || []),
    });
    res.json(palette);
  });

  app.delete("/api/lor_palettes/:id", requireAuth, (req, res) => {
    const paletteId = parseInt(String(req.params.id), 10);
    const row = storage.getLorPalette(paletteId);
    if (!row) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(row.projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    storage.deleteLorPalette(paletteId);
    res.json({ success: true });
  });

  // 4. Asset Revision Tree routes
  app.get("/api/assets/:id/lor_versions", requireAuth, (req, res) => {
    const assetId = parseInt(String(req.params.id), 10);
    const asset = storage.getAsset(assetId);
    if (!asset) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(asset.projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    const versions = storage.listLorAssetVersions(assetId);
    res.json(versions);
  });

  app.post("/api/assets/:id/lor_versions", requireAuth, (req, res) => {
    const assetId = parseInt(String(req.params.id), 10);
    const asset = storage.getAsset(assetId);
    if (!asset) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(asset.projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    // find max version
    const existing = storage.listLorAssetVersions(assetId);
    const nextVer = existing.length > 0 ? Math.max(...existing.map(v => v.versionNum)) + 1 : 1;
    
    // auto-approve the newest version by un-approving others
    if (existing.length > 0) {
      storage.updateLorAssetVersionsForAsset(assetId, { approved: false });
    }

    const newVersion = storage.createLorAssetVersion({
      assetId,
      versionNum: nextVer,
      fileData: req.body.fileData,
      approved: true,
    });

    // UPDATE the base asset with this fileData so that the rest of the app sees the latest approved
    storage.updateAsset(assetId, { fileData: req.body.fileData } as any);

    notifyDiscord(asset.projectId, `New Asset Version Uploaded`, `A new version of asset "${asset.filename}" has been uploaded and auto-approved.`);

    res.json(newVersion);
  });

  app.post("/api/assets/:id/lor_versions/:versionId/approve", requireAuth, (req, res) => {
    const assetId = parseInt(String(req.params.id), 10);
    const versionId = parseInt(String(req.params.versionId), 10);
    const asset = storage.getAsset(assetId);
    if (!asset) return res.status(404).json({ message: "Not found" });
    if (!canAccessProject(asset.projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    
    storage.updateLorAssetVersionsForAsset(assetId, { approved: false });
    const approvedVer = storage.updateLorAssetVersion(versionId, { approved: true });
    
    // update base asset
    if (approvedVer) {
      storage.updateAsset(assetId, { fileData: approvedVer.fileData } as any);
      notifyDiscord(asset.projectId, `Asset Version Approved`, `Version ${approvedVer.versionNum} of asset "${asset.filename}" has been approved.`);
    }
    
    res.json({ success: true });
  });

  // 5. Casting Matrix routes
  app.get("/api/projects/:id/lor_casting", requireAuth, (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    if (!canAccessProject(projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    const matrix = storage.listLorCasting(projectId);
    res.json(matrix);
  });

  app.post("/api/projects/:id/lor_casting/toggle", requireAuth, (req, res) => {
    const { sceneId, entityId, present } = req.body;
    const projectId = parseInt(String(req.params.id), 10);
    if (!canAccessProject(projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    
    storage.upsertLorCasting(projectId, sceneId, entityId, present);
    
    res.json({ success: true });
  });

  // 6. Lore-Safe Checklist route (run NLP against script + facts)
  app.post("/api/projects/:id/lor_check_script", requireAuth, (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    if (!canAccessProject(projectId, (req as any).user.id)) return res.status(403).json({ message: "No access" });
    const { scriptContent } = req.body;
    if (typeof scriptContent !== 'string') return res.status(400).json({ message: "scriptContent must be a string" });
    const facts = storage.listLorFacts(projectId);
    
    // Very basic NLP extraction of capitalized words not at start of sentences
    const words = scriptContent.match(/\b[A-Z][a-z]+\b/g) || [];
    const uniqueProperNouns = Array.from(new Set(words)) as string[];
    
    const matchedEntities: typeof facts = [];
    const unrecognizedWords: string[] = [];

    for (const noun of uniqueProperNouns) {
      // ignore common
      if (['The', 'A', 'An', 'It', 'He', 'She', 'They', 'We', 'I', 'And', 'But', 'Or'].includes(noun)) continue;
      
      const matchedFact = facts.find(f => f.title.toLowerCase().includes(noun.toLowerCase()));
      if (matchedFact) {
        if (!matchedEntities.find(e => e.id === matchedFact.id)) {
          matchedEntities.push(matchedFact);
        }
      } else {
        unrecognizedWords.push(noun);
      }
    }

    res.json({ matchedEntities, unrecognizedWords });
  });
}
