// glTF 2.0 export for storyboards: one textured, unlit plane per panel laid out left-to-right, plus
// a camera framing the row. Opens in Blender (File > Import > glTF), three.js, Godot, etc.
//
// Pure functions only; the route is responsible for fetching and normalising panel images.

export type RasterMime = "image/png" | "image/jpeg";

export interface GltfPanelInput {
  /** 1-based position in the scene. */
  number: number;
  image: Buffer;
  mime: RasterMime;
  width: number;
  height: number;
  caption?: string;
  dialogue?: string;
  notes?: string;
  status?: string;
  frameCount?: number;
}

const FALLBACK_ASPECT = 16 / 9;
const GAP = 0.2;
const YFOV = 0.6;

/** Reads pixel dimensions from PNG/JPEG headers without decoding the image. */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString("ascii", 12, 16) === "IHDR") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker === 0xff) { off++; continue; }
      // Standalone markers carry no length.
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
      const len = buf.readUInt16BE(off + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      off += 2 + len;
    }
  }
  return null;
}

/** Splits a base64 data URL into bytes and mime type. */
export function parseDataUrl(dataUrl: string): { mime: string; data: Buffer } | null {
  const m = /^data:([^;,]+)(?:;[^,]*)?;base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1].toLowerCase(), data: Buffer.from(m[2], "base64") };
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const safeName = (s: string) => s.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "") || "scene";

export function buildStoryboardGltf(sceneName: string, panels: GltfPanelInput[]) {
  if (panels.length === 0) throw new Error("No panels with images to export");

  // Shared unit quad (-0.5..0.5); each panel node scales it to its aspect ratio.
  const positions = Buffer.from(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]).buffer);
  const uvs = Buffer.from(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]).buffer);
  const indices = Buffer.from(new Uint16Array([0, 1, 2, 0, 2, 3]).buffer);
  const buffer = Buffer.concat([positions, uvs, indices]);

  const sizes = panels.map((p) => {
    const aspect = p.width > 0 && p.height > 0 ? p.width / p.height : FALLBACK_ASPECT;
    return { w: aspect, h: 1 };
  });
  const totalWidth = sizes.reduce((sum, s) => sum + s.w, 0) + GAP * (panels.length - 1);
  let cursor = -totalWidth / 2;

  const panelNodes = panels.map((p, i) => {
    const { w, h } = sizes[i];
    const x = cursor + w / 2;
    cursor += w + GAP;
    return {
      name: `Panel_${pad2(p.number)}`,
      mesh: i,
      translation: [x, 0, 0],
      scale: [w, h, 1],
      extras: {
        panel: p.number,
        caption: p.caption ?? "",
        dialogue: p.dialogue ?? "",
        notes: p.notes ?? "",
        status: p.status ?? "",
        frameCount: p.frameCount ?? null,
      },
    };
  });

  // Back the camera off far enough to fit the whole row (with a little margin).
  const aspectRatio = FALLBACK_ASPECT;
  const distance = Math.max(
    (1 / 2) / Math.tan(YFOV / 2),
    (totalWidth / 2) / (Math.tan(YFOV / 2) * aspectRatio),
  ) * 1.1;

  return {
    asset: { version: "2.0", generator: "Cel storyboard exporter" },
    extensionsUsed: ["KHR_materials_unlit"],
    scene: 0,
    scenes: [{ name: safeName(sceneName), nodes: [0, ...panelNodes.map((_, i) => i + 1)] }],
    cameras: [{ name: "Overview", type: "perspective", perspective: { yfov: YFOV, aspectRatio, znear: 0.1, zfar: distance * 4 + 10 } }],
    nodes: [{ name: "Overview_Camera", camera: 0, translation: [0, 0, distance] }, ...panelNodes],
    meshes: panels.map((p, i) => ({
      name: `Panel_${pad2(p.number)}`,
      primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: i, mode: 4 }],
    })),
    materials: panels.map((p, i) => ({
      name: `Panel_${pad2(p.number)}_mat`,
      doubleSided: true,
      pbrMetallicRoughness: { baseColorTexture: { index: i }, metallicFactor: 0, roughnessFactor: 1 },
      extensions: { KHR_materials_unlit: {} },
    })),
    textures: panels.map((_, i) => ({ source: i, sampler: 0 })),
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: panels.map((p, i) => ({
      name: `Panel_${pad2(p.number)}`,
      mimeType: p.mime,
      uri: `data:${p.mime};base64,${panels[i].image.toString("base64")}`,
    })),
    buffers: [{ byteLength: buffer.byteLength, uri: `data:application/octet-stream;base64,${buffer.toString("base64")}` }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: uvs.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positions.byteLength + uvs.byteLength, byteLength: indices.byteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: "VEC3", min: [-0.5, -0.5, 0], max: [0.5, 0.5, 0] },
      { bufferView: 1, componentType: 5126, count: 4, type: "VEC2" },
      { bufferView: 2, componentType: 5123, count: 6, type: "SCALAR" },
    ],
  };
}

export function gltfFilename(sceneNumber: string | number, sceneTitle: string) {
  return `${safeName(`scene_${sceneNumber}_${sceneTitle}`)}.gltf`;
}
