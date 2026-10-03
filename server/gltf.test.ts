import { describe, expect, test } from "bun:test";
import { createCanvas } from "@napi-rs/canvas";
import { buildStoryboardGltf, gltfFilename, imageSize, parseDataUrl } from "./gltf";

function raster(width: number, height: number, mime: "image/png" | "image/jpeg") {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(0, 0, width, height);
  return canvas.toBuffer(mime);
}

describe("imageSize", () => {
  test("reads PNG and JPEG dimensions from headers", () => {
    expect(imageSize(raster(40, 20, "image/png"))).toEqual({ width: 40, height: 20 });
    expect(imageSize(raster(64, 36, "image/jpeg"))).toEqual({ width: 64, height: 36 });
  });
  test("returns null for non-images and truncated data", () => {
    expect(imageSize(Buffer.from("not an image"))).toBeNull();
    expect(imageSize(raster(40, 20, "image/png").subarray(0, 10))).toBeNull();
  });
});

describe("parseDataUrl", () => {
  test("splits mime and bytes", () => {
    const parsed = parseDataUrl(`data:image/png;base64,${Buffer.from("abc").toString("base64")}`);
    expect(parsed?.mime).toBe("image/png");
    expect(parsed?.data.toString()).toBe("abc");
  });
  test("rejects non-base64 and non-data URLs", () => {
    expect(parseDataUrl("https://example.com/a.png")).toBeNull();
    expect(parseDataUrl("data:text/plain,hello")).toBeNull();
  });
});

describe("buildStoryboardGltf", () => {
  const png = raster(40, 20, "image/png");
  const jpg = raster(30, 30, "image/jpeg");
  const gltf = buildStoryboardGltf("1A Doorway", [
    { number: 1, image: png, mime: "image/png", width: 40, height: 20, caption: "Wide shot", status: "FINAL" },
    { number: 2, image: jpg, mime: "image/jpeg", width: 30, height: 30 },
  ]);

  test("has one node, mesh, material, texture and image per panel plus a camera", () => {
    expect(gltf.asset.version).toBe("2.0");
    expect(gltf.nodes).toHaveLength(3);
    expect(gltf.meshes).toHaveLength(2);
    expect(gltf.materials).toHaveLength(2);
    expect(gltf.textures).toHaveLength(2);
    expect(gltf.images).toHaveLength(2);
    expect(gltf.scenes[0].nodes).toEqual([0, 1, 2]);
  });

  test("all indices point at things that exist", () => {
    for (const mesh of gltf.meshes) for (const prim of mesh.primitives) {
      expect(prim.material).toBeLessThan(gltf.materials.length);
      for (const accessor of [prim.indices, ...Object.values(prim.attributes)]) expect(accessor).toBeLessThan(gltf.accessors.length);
    }
    for (const texture of gltf.textures) expect(texture.source).toBeLessThan(gltf.images.length);
    for (const view of gltf.bufferViews) expect(view.byteOffset + view.byteLength).toBeLessThanOrEqual(gltf.buffers[0].byteLength);
  });

  test("buffer layout is 4-byte aligned and matches the declared byte length", () => {
    const bytes = parseDataUrl(gltf.buffers[0].uri)!.data;
    expect(bytes.byteLength).toBe(gltf.buffers[0].byteLength);
    for (const view of gltf.bufferViews) expect(view.byteOffset % 4).toBe(0);
  });

  test("panels keep their aspect ratio and sit side by side without overlapping", () => {
    const [, a, b] = gltf.nodes as { scale: number[]; translation: number[] }[];
    expect(a.scale[0] / a.scale[1]).toBeCloseTo(2);
    expect(b.scale[0] / b.scale[1]).toBeCloseTo(1);
    expect(b.translation[0] - a.translation[0]).toBeGreaterThan((a.scale[0] + b.scale[0]) / 2);
  });

  test("embeds the original image bytes and panel metadata", () => {
    expect(parseDataUrl(gltf.images[0].uri)!.data.equals(png)).toBe(true);
    expect(gltf.images[1].mimeType).toBe("image/jpeg");
    expect((gltf.nodes[1] as any).extras).toMatchObject({ panel: 1, caption: "Wide shot", status: "FINAL" });
  });

  test("refuses to export an empty scene", () => {
    expect(() => buildStoryboardGltf("empty", [])).toThrow();
  });
});

describe("gltfFilename", () => {
  test("is filesystem safe", () => {
    expect(gltfFilename("1B", "Bluey appears / in doorway!")).toBe("scene_1B_Bluey_appears_in_doorway.gltf");
  });
});
