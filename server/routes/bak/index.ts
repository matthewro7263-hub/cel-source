import { requireAuth, canAccessProject } from "../../auth.js";
import { Router, Request, Response, NextFunction } from "express";
import { db } from "../../storage.js";
import { storage } from "../../storage.js";
import {
  scripts, storyboardPanels, scenes, assets, bakSnapshots, bakGltfExports,
  projects, comments, projectMembers, storyboards
} from "@shared/schema";
import { eq, isNull, lt, inArray, isNotNull, and, getTableColumns } from "drizzle-orm";
import { createHash } from "node:crypto";

export const bakRouter = Router();

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[2], "base64");
}

function checksumBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// 3. Branching Snapshots
async function captureProjectSnapshot(projectId: number, label: string) {
  const snapshotStoryboards = await db.select().from(storyboards).where(eq(storyboards.projectId, projectId));
  const storyboardIds = snapshotStoryboards.map(sb => sb.id);
  const snapshotPanels = storyboardIds.length > 0 ? await db.select().from(storyboardPanels).where(inArray(storyboardPanels.storyboardId, storyboardIds)) : [];

  const snapshotData = {
    project: await storage.getProject(projectId),
    scripts: await db.select().from(scripts).where(eq(scripts.projectId, projectId)),
    storyboards: snapshotStoryboards,
    panels: snapshotPanels,
    scenes: await db.select().from(scenes).where(eq(scenes.projectId, projectId)),
    comments: await db.select().from(comments).where(eq(comments.projectId, projectId))
  };

  await db.insert(bakSnapshots).values({
    projectId,
    label,
    jsonBlob: JSON.stringify(snapshotData)
  });
}

/** Snapshots are JSON, so timestamps come back as ISO strings; drizzle needs Date objects to insert them. */
function reviveDates(table: Parameters<typeof getTableColumns>[0], rows: any[]): any[] {
  const columns = getTableColumns(table);
  return rows.map((row) => {
    const out = { ...row };
    for (const [key, column] of Object.entries(columns)) {
      if (column.dataType === "date" && typeof out[key] === "string") out[key] = new Date(out[key]);
    }
    return out;
  });
}

bakRouter.post("/projects/:id/snapshot", requireAuth, async (req, res) => {
  const projectId = parseInt(String(req.params.id), 10);
  if (!(await canAccessProject(projectId, req.user!.id))) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { label } = req.body ?? {};
  await captureProjectSnapshot(projectId, typeof label === "string" && label.trim() ? label.trim().slice(0, 120) : "Manual Snapshot");

  res.json({ message: "Snapshot created" });
});

bakRouter.post("/projects/:id/snapshots/:snapId/restore", requireAuth, async (req, res) => {
  const projectId = parseInt(String(req.params.id), 10);
  const snapId = parseInt(String(req.params.snapId), 10);
  
  if (!(await canAccessProject(projectId, req.user!.id))) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const snap = await db.select().from(bakSnapshots).where(eq(bakSnapshots.id, snapId)).then((r) => r[0]);
  if (!snap || snap.projectId !== projectId) {
    return res.status(404).json({ message: "Snapshot not found" });
  }

  const data = JSON.parse(snap.jsonBlob);

  // Restoring replaces everything created since, so keep the pre-restore state as its own snapshot.
  await captureProjectSnapshot(projectId, `Auto-backup before restoring "${snap.label}"`.slice(0, 120));

  const CHUNK_SIZE = 500;
  const insertChunks = async (tx: any, table: any, rows: any[]) => {
    const revived = reviveDates(table, rows ?? []);
    for (let i = 0; i < revived.length; i += CHUNK_SIZE) {
      await tx.insert(table).values(revived.slice(i, i + CHUNK_SIZE));
    }
  };

  await db.transaction(async (tx) => {
    // Panels first: they belong to *current* storyboards, including ones created after the snapshot.
    const currentStoryboards = await tx.select({ id: storyboards.id }).from(storyboards).where(eq(storyboards.projectId, projectId));
    const currentIds = currentStoryboards.map((sb) => sb.id);
    for (let i = 0; i < currentIds.length; i += CHUNK_SIZE) {
      await tx.delete(storyboardPanels).where(inArray(storyboardPanels.storyboardId, currentIds.slice(i, i + CHUNK_SIZE)));
    }

    await tx.delete(scripts).where(eq(scripts.projectId, projectId));
    await insertChunks(tx, scripts, data.scripts);

    await tx.delete(storyboards).where(eq(storyboards.projectId, projectId));
    await insertChunks(tx, storyboards, data.storyboards);
    await insertChunks(tx, storyboardPanels, data.panels);

    await tx.delete(scenes).where(eq(scenes.projectId, projectId));
    await insertChunks(tx, scenes, data.scenes);

    await tx.delete(comments).where(eq(comments.projectId, projectId));
    await insertChunks(tx, comments, data.comments);
  });

  res.json({ message: "Snapshot restored successfully" });
});

bakRouter.get("/projects/:id/snapshots", requireAuth, async (req, res) => {
  const projectId = parseInt(String(req.params.id), 10);
  if (!(await canAccessProject(projectId, req.user!.id))) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const snaps = await db.select({
    id: bakSnapshots.id,
    label: bakSnapshots.label,
    createdAt: bakSnapshots.createdAt
  }).from(bakSnapshots).where(eq(bakSnapshots.projectId, projectId));

  res.json(snaps);
});

// 6. GLTF Export Stub
bakRouter.post("/scenes/:id/gltf-stub", requireAuth, async (req, res) => {
  const sceneId = parseInt(String(req.params.id), 10);
  const sceneObj = await db.select().from(scenes).where(eq(scenes.id, sceneId)).then((r) => r[0]);
  
  if (!sceneObj) return res.status(404).json({ message: "Scene not found" });
  if (!(await canAccessProject(sceneObj.projectId, req.user!.id))) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const positions = Buffer.from(new Float32Array([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0,
  ]).buffer);
  const indices = Buffer.from(new Uint16Array([0, 1, 2, 0, 2, 3]).buffer);
  const buffer = Buffer.concat([positions, indices]);
  const sceneName = `${sceneObj.number}_${sceneObj.title}`.replace(/[^a-z0-9._-]+/gi, "_");

  const gltf = {
    asset: { version: "2.0", generator: "Cel local GLTF stub exporter" },
    scene: 0,
    scenes: [{ name: sceneName, nodes: [0, 1] }],
    nodes: [
      { name: "Camera", translation: [0, 0, 5] },
      { name: "Storyboard_Plane", mesh: 0 },
    ],
    meshes: [{
      name: "Storyboard_Plane",
      primitives: [{
        attributes: { POSITION: 0 },
        indices: 1,
        mode: 4,
      }],
    }],
    buffers: [{
      uri: `data:application/octet-stream;base64,${buffer.toString("base64")}`,
      byteLength: buffer.byteLength,
    }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, byteOffset: 0, componentType: 5126, count: 4, type: "VEC3", min: [-1, -1, 0], max: [1, 1, 0] },
      { bufferView: 1, byteOffset: 0, componentType: 5123, count: 6, type: "SCALAR" },
    ],
  };

  const gltfStr = JSON.stringify(gltf);

  await db.insert(bakGltfExports).values({
    sceneId,
    fileData: gltfStr
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="scene_${sceneId}_stub.gltf"`);
  res.send(gltfStr);
});

// 7. Asset Integrity Scan
bakRouter.get("/projects/:id/trash/integrity", requireAuth, async (req, res) => {
  const projectId = parseInt(String(req.params.id), 10);
  if (!(await canAccessProject(projectId, req.user!.id))) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const projAssets = await db.select().from(assets).where(eq(assets.projectId, projectId));
  const projStoryboards = await db.select().from(storyboards).where(eq(storyboards.projectId, projectId));
  const storyboardIds = projStoryboards.map(sb => sb.id);
  const projPanels = storyboardIds.length > 0
    ? await db.select().from(storyboardPanels).where(inArray(storyboardPanels.storyboardId, storyboardIds))
    : [];

  const items = [
    ...projAssets.map((asset) => ({
      kind: "asset",
      id: asset.id,
      name: asset.filename,
      data: asset.fileData,
      deletedAt: asset.deletedAt,
    })),
    ...projPanels.map((panel) => ({
      kind: "panel",
      id: panel.id,
      name: `Panel ${panel.id}`,
      data: panel.imageData,
      deletedAt: panel.deletedAt,
    })),
  ].map((item) => {
    const buffer = dataUrlToBuffer(item.data || "");
    if (!item.data) {
      return { ...item, status: "missing", sha256: null, bytes: 0, message: "No file payload stored." };
    }
    if (!buffer) {
      return { ...item, status: "corrupt", sha256: null, bytes: 0, message: "File payload is not a valid data URL." };
    }
    return {
      kind: item.kind,
      id: item.id,
      name: item.name,
      deletedAt: item.deletedAt,
      status: "ok",
      sha256: checksumBuffer(buffer),
      bytes: buffer.byteLength,
    };
  });

  res.json({
    checkedAt: new Date().toISOString(),
    ok: items.every((item) => item.status === "ok"),
    counts: {
      total: items.length,
      ok: items.filter((item) => item.status === "ok").length,
      missing: items.filter((item) => item.status === "missing").length,
      corrupt: items.filter((item) => item.status === "corrupt").length,
    },
    items,
  });
});

// 2. Trash Recovery API
bakRouter.get("/projects/:id/trash", requireAuth, async (req, res) => {
  const projectId = parseInt(String(req.params.id), 10);
  if (!(await canAccessProject(projectId, req.user!.id))) {
    return res.status(403).json({ message: "Forbidden" });
  }

  // Not null deletedAt
  const delScripts = (await db.select().from(scripts).where(eq(scripts.projectId, projectId))).filter(x => x.deletedAt !== null);
  const delScenes = (await db.select().from(scenes).where(eq(scenes.projectId, projectId))).filter(x => x.deletedAt !== null);
  const delAssets = (await db.select().from(assets).where(eq(assets.projectId, projectId))).filter(x => x.deletedAt !== null);
  const projStoryboards = await db.select().from(storyboards).where(eq(storyboards.projectId, projectId));
  const storyboardIds = projStoryboards.map(sb => sb.id);
  const delPanels = storyboardIds.length > 0
    ? await db.select().from(storyboardPanels).where(and(inArray(storyboardPanels.storyboardId, storyboardIds), isNotNull(storyboardPanels.deletedAt)))
    : [];
  
  res.json({
    scripts: delScripts,
    scenes: delScenes,
    assets: delAssets,
    panels: delPanels,
  });
});

bakRouter.post("/trash/restore/:kind/:id", requireAuth, async (req, res) => {
  const { kind, id } = req.params;
  const numId = parseInt(String(id), 10);

  // Resolve projectId for access check
  let projectId: number | undefined;
  if (kind === 'script') {
    const row = await db.select().from(scripts).where(eq(scripts.id, numId)).then((r) => r[0]);
    if (!row) return res.status(404).json({ message: "Not found" });
    projectId = row.projectId;
  } else if (kind === 'scene') {
    const row = await db.select().from(scenes).where(eq(scenes.id, numId)).then((r) => r[0]);
    if (!row) return res.status(404).json({ message: "Not found" });
    projectId = row.projectId;
  } else if (kind === 'asset') {
    const row = await db.select().from(assets).where(eq(assets.id, numId)).then((r) => r[0]);
    if (!row) return res.status(404).json({ message: "Not found" });
    projectId = row.projectId;
  } else if (kind === 'panel') {
    const row = await db.select().from(storyboardPanels).where(eq(storyboardPanels.id, numId)).then((r) => r[0]);
    if (!row) return res.status(404).json({ message: "Not found" });
    const sb = await db.select().from(storyboards).where(eq(storyboards.id, row.storyboardId)).then((r) => r[0]);
    if (!sb) return res.status(404).json({ message: "Storyboard not found" });
    projectId = sb.projectId;
  } else {
    return res.status(400).json({ message: "Invalid kind" });
  }

  if (!(await canAccessProject(projectId, req.user!.id))) {
    return res.status(403).json({ message: "No access" });
  }

  if (kind === 'script') {
    await db.update(scripts).set({ deletedAt: null }).where(eq(scripts.id, numId));
  } else if (kind === 'scene') {
    await db.update(scenes).set({ deletedAt: null }).where(eq(scenes.id, numId));
  } else if (kind === 'asset') {
    await db.update(assets).set({ deletedAt: null }).where(eq(assets.id, numId));
  } else if (kind === 'panel') {
    await db.update(storyboardPanels).set({ deletedAt: null }).where(eq(storyboardPanels.id, numId));
  }
  res.json({ message: "Restored" });
});

bakRouter.delete("/trash/permanent/:kind/:id", requireAuth, async (req, res) => {
  const { kind, id } = req.params;
  const numId = parseInt(String(id), 10);

  // Resolve projectId for access check
  let projectId: number | undefined;
  if (kind === 'script') {
    const row = await db.select().from(scripts).where(eq(scripts.id, numId)).then((r) => r[0]);
    if (!row) return res.status(404).json({ message: "Not found" });
    projectId = row.projectId;
  } else if (kind === 'scene') {
    const row = await db.select().from(scenes).where(eq(scenes.id, numId)).then((r) => r[0]);
    if (!row) return res.status(404).json({ message: "Not found" });
    projectId = row.projectId;
  } else if (kind === 'asset') {
    const row = await db.select().from(assets).where(eq(assets.id, numId)).then((r) => r[0]);
    if (!row) return res.status(404).json({ message: "Not found" });
    projectId = row.projectId;
  } else if (kind === 'panel') {
    const row = await db.select().from(storyboardPanels).where(eq(storyboardPanels.id, numId)).then((r) => r[0]);
    if (!row) return res.status(404).json({ message: "Not found" });
    const sb = await db.select().from(storyboards).where(eq(storyboards.id, row.storyboardId)).then((r) => r[0]);
    if (!sb) return res.status(404).json({ message: "Storyboard not found" });
    projectId = sb.projectId;
  } else {
    return res.status(400).json({ message: "Invalid kind" });
  }

  if (!(await canAccessProject(projectId, req.user!.id))) {
    return res.status(403).json({ message: "No access" });
  }

  if (kind === 'script') {
    await db.delete(scripts).where(eq(scripts.id, numId));
  } else if (kind === 'scene') {
    await db.delete(scenes).where(eq(scenes.id, numId));
  } else if (kind === 'asset') {
    await db.delete(assets).where(eq(assets.id, numId));
  } else if (kind === 'panel') {
    await db.delete(storyboardPanels).where(eq(storyboardPanels.id, numId));
  }
  res.json({ message: "Permanently deleted" });
});
