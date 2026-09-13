/**
 * Development-only test model for /labs/viewer: a slab with a tower on it,
 * generated in memory as a glTF 2.0 binary. Takes no input and never fetches
 * anything, so it exercises the `model` loading path without committing a
 * binary asset or pointing the viewer at a remote URL.
 */

function buildSampleGlb(): ArrayBuffer {
  // Unit cube: 4 vertices per face so each face gets a flat normal.
  // [normal, u, v] with u × v = normal, giving counter-clockwise winding.
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  const positions = new Float32Array(24 * 3);
  const normals = new Float32Array(24 * 3);
  const indices = new Uint16Array(36);
  faces.forEach(([n, u, v], face) => {
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    corners.forEach(([su, sv], corner) => {
      const i = (face * 4 + corner) * 3;
      for (let axis = 0; axis < 3; axis++) {
        positions[i + axis] = 0.5 * (n[axis] + su * u[axis] + sv * v[axis]);
        normals[i + axis] = n[axis];
      }
    });
    const base = face * 4;
    indices.set([base, base + 1, base + 2, base, base + 2, base + 3], face * 6);
  });

  const bin = new Uint8Array(positions.byteLength + normals.byteLength + indices.byteLength);
  bin.set(new Uint8Array(positions.buffer), 0);
  bin.set(new Uint8Array(normals.buffer), positions.byteLength);
  bin.set(new Uint8Array(indices.buffer), positions.byteLength + normals.byteLength);

  const primitive = (material: number) => ({ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material });
  const gltf = {
    asset: { version: "2.0", generator: "Aarvasa viewer lab" },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [
      { name: "slab", mesh: 0, scale: [2.4, 0.2, 2.4], translation: [0, 0.1, 0] },
      { name: "tower", mesh: 1, scale: [0.9, 1.8, 0.9], translation: [0, 1.1, 0] },
    ],
    meshes: [{ primitives: [primitive(0)] }, { primitives: [primitive(1)] }],
    materials: [
      { name: "stone", pbrMetallicRoughness: { baseColorFactor: [0.8, 0.78, 0.74, 1], metallicFactor: 0, roughnessFactor: 0.85 } },
      { name: "gold", pbrMetallicRoughness: { baseColorFactor: [0.83, 0.69, 0.22, 1], metallicFactor: 0.4, roughnessFactor: 0.45 } },
    ],
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: normals.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positions.byteLength + normals.byteLength, byteLength: indices.byteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: "VEC3", min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" },
      { bufferView: 2, componentType: 5123, count: 36, type: "SCALAR" },
    ],
  };

  // GLB chunks must be 4-byte aligned: JSON pads with spaces, BIN with zeros.
  const pad = (length: number) => (4 - (length % 4)) % 4;
  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLength = jsonBytes.length + pad(jsonBytes.length);
  const binLength = bin.length + pad(bin.length);
  const total = 12 + 8 + jsonLength + 8 + binLength;

  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  bytes.fill(0x20, 20, 20 + jsonLength);
  bytes.set(jsonBytes, 20);
  const binStart = 20 + jsonLength;
  view.setUint32(binStart, binLength, true);
  view.setUint32(binStart + 4, 0x004e4942, true); // "BIN\0"
  bytes.set(bin, binStart + 8);
  return out;
}

export async function GET(_request: Request, { params }: { params: Promise<{ lab: string }> }) {
  const { lab } = await params;
  if (process.env.NODE_ENV === "production" || lab !== "viewer") {
    return new Response("Not found", { status: 404 });
  }
  return new Response(buildSampleGlb(), {
    headers: { "Content-Type": "model/gltf-binary", "Cache-Control": "no-store" },
  });
}
