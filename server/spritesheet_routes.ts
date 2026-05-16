import type { Express, Request, Response, NextFunction } from "express";
import { db, getSessionUser, storage } from "./storage";
import { eq, inArray } from "drizzle-orm";
import { storyboardPanels, storyboards } from "@shared/schema";
import { z } from "zod";
import archiver from "archiver";
import { createCanvas, loadImage } from "canvas";

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

function nearestPow2(v: number) {
  let p = 1;
  while (p < v) p *= 2;
  return p;
}

function generateMinimalGLTF(b64Data: string, bufferLength: number) {
  return {
    asset: { version: "2.0", generator: "Cel Sprite-Sheet Packer" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ mesh: 0, name: "SpriteQuad" }],
    meshes: [
      {
        primitives: [
          {
            attributes: {
              POSITION: 1,
              TEXCOORD_0: 2
            },
            indices: 0,
            material: 0
          }
        ]
      }
    ],
    materials: [
      {
        name: "SpriteMaterial",
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 1
        },
        doubleSided: true
      }
    ],
    textures: [{ source: 0 }],
    images: [{ uri: "spritesheet.png" }],
    buffers: [
      {
        uri: `data:application/octet-stream;base64,${b64Data}`,
        byteLength: bufferLength
      }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 12, target: 34963 },
      { buffer: 0, byteOffset: 12, byteLength: 48, target: 34962 },
      { buffer: 0, byteOffset: 60, byteLength: 32, target: 34962 }
    ],
    accessors: [
      { bufferView: 0, byteOffset: 0, componentType: 5123, count: 6, type: "SCALAR" },
      { bufferView: 1, byteOffset: 0, componentType: 5126, count: 4, type: "VEC3", max: [0.5, 0.5, 0], min: [-0.5, -0.5, 0] },
      { bufferView: 2, byteOffset: 0, componentType: 5126, count: 4, type: "VEC2" }
    ]
  };
}

export function registerSpriteSheetRoutes(app: Express) {
  app.post("/api/projects/:id/spritesheet", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.id), 10);
    if (!(await canAccessProject(projectId, (req as any).user.id))) {
      return res.status(403).json({ message: "No access" });
    }

    const schema = z.object({
      panelIds: z.array(z.number().int().positive()).min(1, "Select at least one panel"),
      potPadding: z.boolean().default(false)
    });

    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(req.body);
    } catch (e: any) {
      return res.status(400).json({ message: e.message });
    }

    try {
      // Verify panels belong to storyboards in this project
      const projectSbs = await db.select().from(storyboards).where(eq(storyboards.projectId, projectId));
      const sbIds = projectSbs.map(s => s.id);
      if (sbIds.length === 0) {
        return res.status(400).json({ message: "No storyboards in this project" });
      }

      const panels = (await db.select()
        .from(storyboardPanels)
        .where(inArray(storyboardPanels.id, body.panelIds))
      ).filter(p => sbIds.includes(p.storyboardId)); // Only panels belonging to this project

      const images = [];
      for (const p of panels) {
        if (!p.imageData) continue;
        const img = await loadImage(p.imageData);
        images.push({ p, img });
      }

      if (images.length === 0) {
         return res.status(400).json({ message: "Selected panels have no image data" });
      }

      let maxW = 0, maxH = 0;
      images.forEach(({img}) => {
        if (img.width > maxW) maxW = img.width;
        if (img.height > maxH) maxH = img.height;
      });

      const count = images.length;
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);

      let sheetW = cols * maxW;
      let sheetH = rows * maxH;

      if (body.potPadding) {
        sheetW = nearestPow2(sheetW);
        sheetH = nearestPow2(sheetH);
      }

      const canvas = createCanvas(sheetW, sheetH);
      const ctx = canvas.getContext('2d');

      const atlas: any = { frames: {}, meta: { app: "Cel", size: { w: sheetW, h: sheetH } } };

      images.forEach(({p, img}, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = col * maxW;
        const y = row * maxH;
        ctx.drawImage(img, x, y);
        
        atlas.frames[`panel_${p.id}`] = {
          frame: { x, y, w: img.width, h: img.height },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: img.width, h: img.height },
          sourceSize: { w: img.width, h: img.height }
        };
      });

      const pngBuffer = canvas.toBuffer('image/png');

      // Generate GLTF buffer base64
      const vertices = new Float32Array([-0.5,-0.5,0, 0.5,-0.5,0, -0.5,0.5,0, 0.5,0.5,0]);
      const uvs = new Float32Array([0,1, 1,1, 0,0, 1,0]);
      const indices = new Uint16Array([0,1,2, 1,3,2]);
      const buffer = Buffer.concat([
        Buffer.from(indices.buffer),
        Buffer.from(vertices.buffer),
        Buffer.from(uvs.buffer)
      ]);
      const b64 = buffer.toString("base64");
      const gltfObj = generateMinimalGLTF(b64, buffer.length);

      const archive = archiver("zip", { zlib: { level: 5 } });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="project-${projectId}-spritesheet.zip"`);
      archive.pipe(res);

      archive.append(pngBuffer, { name: 'spritesheet.png' });
      archive.append(JSON.stringify(atlas, null, 2), { name: 'atlas.json' });
      archive.append(JSON.stringify(gltfObj, null, 2), { name: 'model.gltf' });

      await archive.finalize();

    } catch (err) {
      console.error("Spritesheet export failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Export failed" });
      }
    }
  });
}
