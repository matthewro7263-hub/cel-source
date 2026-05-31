import fs from "fs";

const vertices = new Float32Array([
  -0.5, -0.5, 0,
   0.5, -0.5, 0,
  -0.5,  0.5, 0,
   0.5,  0.5, 0
]);
const uvs = new Float32Array([
  0, 1,
  1, 1,
  0, 0,
  1, 0
]);
const indices = new Uint16Array([
  0, 1, 2,
  1, 3, 2
]);

const buffer = Buffer.concat([
  Buffer.from(indices.buffer),
  Buffer.from(vertices.buffer),
  Buffer.from(uvs.buffer)
]);

const b64 = buffer.toString("base64");

const gltf = {
  asset: { version: "2.0" },
  scenes: [{ nodes: [0] }],
  scene: 0,
  nodes: [{ mesh: 0 }],
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
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 1
      }
    }
  ],
  textures: [{ source: 0 }],
  images: [{ uri: "spritesheet.png" }],
  buffers: [
    {
      uri: `data:application/octet-stream;base64,${b64}`,
      byteLength: buffer.length
    }
  ],
  bufferViews: [
    {
      buffer: 0,
      byteOffset: 0,
      byteLength: 12,
      target: 34963 // ELEMENT_ARRAY_BUFFER
    },
    {
      buffer: 0,
      byteOffset: 12,
      byteLength: 48,
      target: 34962 // ARRAY_BUFFER
    },
    {
      buffer: 0,
      byteOffset: 60,
      byteLength: 32,
      target: 34962 // ARRAY_BUFFER
    }
  ],
  accessors: [
    {
      bufferView: 0,
      byteOffset: 0,
      componentType: 5123, // UNSIGNED_SHORT
      count: 6,
      type: "SCALAR"
    },
    {
      bufferView: 1,
      byteOffset: 0,
      componentType: 5126, // FLOAT
      count: 4,
      type: "VEC3",
      max: [0.5, 0.5, 0],
      min: [-0.5, -0.5, 0]
    },
    {
      bufferView: 2,
      byteOffset: 0,
      componentType: 5126, // FLOAT
      count: 4,
      type: "VEC2"
    }
  ]
};
